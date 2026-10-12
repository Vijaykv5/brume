use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use session_keys::{session_auth_or, Session, SessionError, SessionTokenV2};

declare_id!("5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p");

pub const WORLD_SESSION_SEED: &[u8] = b"world-session";
pub const DEFAULT_COMMIT_FREQUENCY_MS: u32 = 30_000;

#[ephemeral]
#[program]
pub mod brume_world {
    use super::*;

    /// Creates the durable Solana account that anchors one BRUME world session.
    pub fn initialize_world_session(
        ctx: Context<InitializeWorldSession>,
        world_id: [u8; 16],
    ) -> Result<()> {
        let world_session = &mut ctx.accounts.world_session;
        world_session.authority = ctx.accounts.authority.key();
        world_session.world_id = world_id;
        world_session.bump = ctx.bumps.world_session;
        world_session.interaction_count = 0;
        world_session.last_actor = Pubkey::default();
        world_session.last_interaction = InteractionKind::Player;
        world_session.last_interaction_at = 0;

        emit!(WorldSessionCreated {
            world_session: world_session.key(),
            authority: world_session.authority,
            world_id,
        });

        Ok(())
    }

    /// Records an explicit social-world action. This is intentionally separate
    /// from high-frequency avatar movement, which remains on the WebSocket layer.
    pub fn record_interaction(
        ctx: Context<RecordInteraction>,
        interaction: InteractionKind,
    ) -> Result<()> {
        let world_session = &mut ctx.accounts.world_session;
        world_session.interaction_count = world_session
            .interaction_count
            .checked_add(1)
            .ok_or(BrumeError::InteractionCountOverflow)?;
        world_session.last_actor = ctx.accounts.actor.key();
        world_session.last_interaction = interaction;
        world_session.last_interaction_at = Clock::get()?.unix_timestamp;

        emit!(InteractionRecorded {
            world_session: world_session.key(),
            actor: world_session.last_actor,
            interaction,
            interaction_count: world_session.interaction_count,
        });

        Ok(())
    }

    /// Records a social action through a wallet-authorized, short-lived session
    /// key. The session token binds the ephemeral signer to the wallet that owns
    /// this world session, so the ER never trusts an arbitrary generated key.
    #[session_auth_or(
        ctx.accounts.actor.key() == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn record_session_interaction(
        ctx: Context<RecordSessionInteraction>,
        interaction: InteractionKind,
    ) -> Result<()> {
        let world_session = &mut ctx.accounts.world_session;
        world_session.interaction_count = world_session
            .interaction_count
            .checked_add(1)
            .ok_or(BrumeError::InteractionCountOverflow)?;
        world_session.last_actor = ctx.accounts.actor.key();
        world_session.last_interaction = interaction;
        world_session.last_interaction_at = Clock::get()?.unix_timestamp;

        emit!(InteractionRecorded {
            world_session: world_session.key(),
            actor: world_session.last_actor,
            interaction,
            interaction_count: world_session.interaction_count,
        });

        Ok(())
    }

    /// Finalizes a two-player social encounter on the ER. The actor is proven
    /// by a scoped session token; the target and result are emitted together so
    /// explorers can verify who participated in the shared outcome.
    #[session_auth_or(
        ctx.accounts.actor.key() == ctx.accounts.payer.key(),
        SessionError::InvalidToken
    )]
    pub fn record_session_encounter(
        ctx: Context<RecordSessionEncounter>,
        result: EncounterResult,
    ) -> Result<()> {
        require_keys_neq!(
            ctx.accounts.actor.key(),
            ctx.accounts.target.key(),
            BrumeError::InvalidEncounter
        );
        let world_session = &mut ctx.accounts.world_session;
        world_session.interaction_count = world_session
            .interaction_count
            .checked_add(1)
            .ok_or(BrumeError::InteractionCountOverflow)?;
        world_session.last_actor = ctx.accounts.actor.key();
        world_session.last_interaction = match result {
            EncounterResult::HighFive => InteractionKind::HighFive,
            EncounterResult::RpsWin => InteractionKind::RpsWin,
            EncounterResult::RpsLoss => InteractionKind::RpsLoss,
            EncounterResult::RpsDraw => InteractionKind::RpsDraw,
        };
        world_session.last_interaction_at = Clock::get()?.unix_timestamp;

        emit!(EncounterRecorded {
            world_session: world_session.key(),
            actor: ctx.accounts.actor.key(),
            target: ctx.accounts.target.key(),
            result,
            interaction_count: world_session.interaction_count,
        });

        Ok(())
    }

    /// Delegates the WorldSession PDA from Solana to a MagicBlock validator.
    /// An optional validator public key may be supplied as the first remaining
    /// account; otherwise MagicBlock's routing/default validator is used.
    pub fn delegate_world_session(
        ctx: Context<DelegateWorldSession>,
        world_id: [u8; 16],
    ) -> Result<()> {
        let data = ctx.accounts.pda.try_borrow_data()?;
        let world_session = WorldSession::try_deserialize(&mut data.as_ref())?;
        require_keys_eq!(
            world_session.authority,
            ctx.accounts.payer.key(),
            BrumeError::Unauthorized
        );
        drop(data);

        let payer_key = ctx.accounts.payer.key();
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[WORLD_SESSION_SEED, payer_key.as_ref(), world_id.as_ref()],
            DelegateConfig {
                commit_frequency_ms: DEFAULT_COMMIT_FREQUENCY_MS,
                validator: ctx.remaining_accounts.first().map(|account| account.key()),
            },
        )?;

        Ok(())
    }

    /// Schedules the latest ER state to be committed back to Solana while the
    /// account remains delegated for further low-latency interactions.
    pub fn commit_world_session(ctx: Context<CommitWorldSession>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.world_session.to_account_info()])
        .build_and_invoke()?;

        Ok(())
    }

    /// Commits the final ER state and returns ownership of the session account
    /// to this program on Solana.
    pub fn commit_and_undelegate_world_session(ctx: Context<CommitWorldSession>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.world_session.to_account_info()])
        .build_and_invoke()?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(world_id: [u8; 16])]
pub struct InitializeWorldSession<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + WorldSession::INIT_SPACE,
        seeds = [WORLD_SESSION_SEED, authority.key().as_ref(), world_id.as_ref()],
        bump,
    )]
    pub world_session: Account<'info, WorldSession>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordInteraction<'info> {
    #[account(
        mut,
        seeds = [
            WORLD_SESSION_SEED,
            world_session.authority.as_ref(),
            world_session.world_id.as_ref(),
        ],
        bump = world_session.bump,
    )]
    pub world_session: Account<'info, WorldSession>,
    pub actor: Signer<'info>,
}

#[derive(Accounts, Session)]
pub struct RecordSessionInteraction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            WORLD_SESSION_SEED,
            world_session.authority.as_ref(),
            world_session.world_id.as_ref(),
        ],
        bump = world_session.bump,
    )]
    pub world_session: Account<'info, WorldSession>,
    /// CHECK: The session token binds this public key to `payer`. Direct calls
    /// require this account and `payer` to be the same signer.
    pub actor: UncheckedAccount<'info>,
    #[session(
        signer = payer,
        authority = actor.key()
    )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[derive(Accounts, Session)]
pub struct RecordSessionEncounter<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            WORLD_SESSION_SEED,
            world_session.authority.as_ref(),
            world_session.world_id.as_ref(),
        ],
        bump = world_session.bump,
    )]
    pub world_session: Account<'info, WorldSession>,
    /// CHECK: Bound to the session token as its wallet authority.
    pub actor: UncheckedAccount<'info>,
    /// CHECK: Recorded as the counterparty; constrained to differ from actor.
    pub target: UncheckedAccount<'info>,
    #[session(
        signer = payer,
        authority = actor.key()
    )]
    pub session_token: Option<Account<'info, SessionTokenV2>>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(world_id: [u8; 16])]
pub struct DelegateWorldSession<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The seeds constrain this to the canonical WorldSession PDA. The
    /// account data is deserialized and its authority checked before delegation.
    #[account(
        mut,
        del,
        seeds = [WORLD_SESSION_SEED, payer.key().as_ref(), world_id.as_ref()],
        bump,
    )]
    pub pda: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitWorldSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            WORLD_SESSION_SEED,
            world_session.authority.as_ref(),
            world_session.world_id.as_ref(),
        ],
        bump = world_session.bump,
        has_one = authority @ BrumeError::Unauthorized,
    )]
    pub world_session: Account<'info, WorldSession>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct WorldSession {
    pub authority: Pubkey,
    pub world_id: [u8; 16],
    pub bump: u8,
    pub interaction_count: u64,
    pub last_actor: Pubkey,
    pub last_interaction: InteractionKind,
    pub last_interaction_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, InitSpace, PartialEq)]
pub enum InteractionKind {
    Player,
    Billboard,
    Building,
    ChatRequest,
    HighFive,
    RpsWin,
    RpsLoss,
    RpsDraw,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, InitSpace, PartialEq)]
pub enum EncounterResult {
    HighFive,
    RpsWin,
    RpsLoss,
    RpsDraw,
}

#[event]
pub struct WorldSessionCreated {
    pub world_session: Pubkey,
    pub authority: Pubkey,
    pub world_id: [u8; 16],
}

#[event]
pub struct InteractionRecorded {
    pub world_session: Pubkey,
    pub actor: Pubkey,
    pub interaction: InteractionKind,
    pub interaction_count: u64,
}

#[event]
pub struct EncounterRecorded {
    pub world_session: Pubkey,
    pub actor: Pubkey,
    pub target: Pubkey,
    pub result: EncounterResult,
    pub interaction_count: u64,
}

#[error_code]
pub enum BrumeError {
    #[msg("Only the world session authority may perform this action")]
    Unauthorized,
    #[msg("The world session interaction counter overflowed")]
    InteractionCountOverflow,
    #[msg("An encounter requires two different wallets")]
    InvalidEncounter,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn world_session_has_stable_capacity() {
        assert_eq!(WorldSession::INIT_SPACE, 98);
    }

    #[test]
    fn interaction_variants_round_trip() {
        let interaction = InteractionKind::Billboard;
        let mut encoded = Vec::new();
        interaction
            .serialize(&mut encoded)
            .expect("serialize interaction");
        let decoded =
            InteractionKind::deserialize(&mut encoded.as_slice()).expect("deserialize interaction");
        assert_eq!(decoded, interaction);
    }
}
