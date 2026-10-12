export const MAGICBLOCK_DEPLOYMENT = {
  cluster: "devnet",
  programId: "5dhS3bs4CfLaNq6sEvwnDcqkTjkYPKYeettb2BE47C7p",
  authority: "2eDJJZydDTV4HQmbtX6YwhrdfCW7XU3zms9538HGqkuB",
  worldIdUtf8: "BRUME-WORLD-V1",
  worldIdBytes: [66, 82, 85, 77, 69, 45, 87, 79, 82, 76, 68, 45, 86, 49, 0, 0],
  worldSessionPda: "3UrnvFqSpYMdCWY1psEiyii2EKANpxnv4q7uWu3xCmv7",
  magicBlockValidator: "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57",
  ephemeralRpc: "https://devnet-as.magicblock.app",
  deploymentSignature:
    "5GecY3pqpesyCGTmV3CPKXdy7ZJJcdz2AQtrHcfMiPqaiFdm7BvRjcKGRyVSy1WxqzZ4xeoCW2dUhQQuZjrpDB8L",
  sessionKeysUpgradeSignature:
    "hScdcg3LiNm4y5CuNyF8PqNVG7LLdDZMCMjMPkgnwPKJm1xjbCQWTEjHWDWftveTrmZkCKvbL5x1aGvWJK9w6wn",
  encounterUpgradeSignature:
    "2k3PYvrCNeyTdxWrwVrZFacFCh5hGFmEUWzn34MFRgn4qsoCL4crBbVgiM6bSLgEwnrtAuJSgBQfJ5kQheN9xCJj",
  encounterAuthorizationSignature:
    "5LisncwVNaFjETbp8g7pVdbazDR7PA6rzi6mJ6dhvu3DEZtvRMEQF4uDFMJQ4Rg2cAWUKjxfvWcBNcZ71tTQDuLP",
  initialEncounterErSignature:
    "5ftiBj4W6dXiz5csyC5h1zHSuSWdXCzkmEJnSb2MsnWgD4hJrcccv3Wa5iQgt2De9bmgUeav6RLKxN12kgzSvsQR",
  initializeSignature:
    "4TbZyh1eeGHUFowsFmdSv6Ex7sjci5MsRTMZ1NZUJwpcJPpki4z3a47Z9QVbZNJpVSDTbJ8JugBz6TXJSX7fiYU3",
  delegationSignature:
    "4Jp9D8WxXyTtNJ2fhbtZbEEFWEgpaL8yRTP3BL9CnwRiHKnRdMLdX5X6NGbfVHKvDFtrC1RwLZKpSfZj7PcdQkbM",
  initialErInteractionSignature:
    "45kzvieFiyRT281J52rpYq5vGACwoAN3cQFbpCKJnANF3CG3j8xY1GEuRvQxGyUtSpmLx3MJypvCUSC19d2x5MxC",
  erCommitSignature:
    "47VcYFy2Vqo9VgHNcBV4RRT387ebfCTkrNiuTWnEa37d8bBKE74djvTBFoKEhSg1voMtJQy41JKHSY4oYSkAEFNP",
  baseCommitSignature:
    "4uSFtnZNbQV334L4yAXPfSUwkdmZYZSbVm2Ga187tCzijbyAwxk4LYK2BuaR9cpnLg5FKiygfFAGfQA95BoZPZHs",
  provisionedAt: "2026-10-12T18:05:45.000Z",
} as const;

export const MAGICBLOCK_DELEGATION_PROGRAM =
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh";

export const MAGICBLOCK_SESSION_PROGRAM =
  "KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5";

export const MAGICBLOCK_ER_RPC =
  process.env.NEXT_PUBLIC_MAGICBLOCK_RPC_URL?.trim() ||
  MAGICBLOCK_DEPLOYMENT.ephemeralRpc;
