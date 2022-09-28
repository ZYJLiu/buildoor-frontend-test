export type Lootbox = {
  "version": "0.1.0",
  "name": "lootbox",
  "instructions": [
    {
      "name": "initLootbox",
      "accounts": [
        {
          "name": "lootbox",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "LOOTBOX"
              }
            ]
          }
        },
        {
          "name": "mintOne",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mintTwo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mintThree",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mintAuth",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "MINT_AUTH"
              }
            ]
          }
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initUser",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "type": "publicKey",
                "path": "payer"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "vrf"
              }
            ]
          }
        },
        {
          "name": "vrf",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "InitUserParams"
          }
        }
      ]
    },
    {
      "name": "requestRandomness",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "type": "publicKey",
                "path": "payer"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "vrf"
              }
            ]
          }
        },
        {
          "name": "vrf",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracleQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "queueAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dataBuffer",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "permission",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrow",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "switchboardProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payerWallet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "recentBlockhashes",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "consumeRandomness",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "type": "publicKey",
                "path": "payer"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "vrf"
              }
            ]
          }
        },
        {
          "name": "vrf",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lootbox",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "mintRewards",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintAuthority",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "MINT_AUTH"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "userState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "switchboardStateBump",
            "type": "u8"
          },
          {
            "name": "vrfPermissionBump",
            "type": "u8"
          },
          {
            "name": "resultBuffer",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "result",
            "type": "u128"
          },
          {
            "name": "vrf",
            "type": "publicKey"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "tokenAccount",
            "type": "publicKey"
          },
          {
            "name": "redeemable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "lootbox",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintOne",
            "type": "publicKey"
          },
          {
            "name": "mintTwo",
            "type": "publicKey"
          },
          {
            "name": "mintThree",
            "type": "publicKey"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "InitUserParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "switchboardStateBump",
            "type": "u8"
          },
          {
            "name": "vrfPermissionBump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidVrfAuthorityError",
      "msg": "Switchboard VRF Account's authority should be set to the client's state pubkey"
    },
    {
      "code": 6001,
      "name": "InvalidVrfAccount",
      "msg": "Invalid VRF account provided."
    },
    {
      "code": 6002,
      "name": "AlreadyRedeemed",
      "msg": "Already Redeemed"
    }
  ]
};

export const IDL: Lootbox = {
  "version": "0.1.0",
  "name": "lootbox",
  "instructions": [
    {
      "name": "initLootbox",
      "accounts": [
        {
          "name": "lootbox",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "LOOTBOX"
              }
            ]
          }
        },
        {
          "name": "mintOne",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mintTwo",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mintThree",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "mintAuth",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "MINT_AUTH"
              }
            ]
          }
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "initUser",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "type": "publicKey",
                "path": "payer"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "vrf"
              }
            ]
          }
        },
        {
          "name": "vrf",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": "InitUserParams"
          }
        }
      ]
    },
    {
      "name": "requestRandomness",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "type": "publicKey",
                "path": "payer"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "vrf"
              }
            ]
          }
        },
        {
          "name": "vrf",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracleQueue",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "queueAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dataBuffer",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "permission",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "escrow",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "switchboardProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payerWallet",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "recentBlockhashes",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "consumeRandomness",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "type": "publicKey",
                "path": "payer"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "vrf"
              }
            ]
          }
        },
        {
          "name": "vrf",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lootbox",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "mintRewards",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "mintAuthority",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "MINT_AUTH"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "userState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "switchboardStateBump",
            "type": "u8"
          },
          {
            "name": "vrfPermissionBump",
            "type": "u8"
          },
          {
            "name": "resultBuffer",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "result",
            "type": "u128"
          },
          {
            "name": "vrf",
            "type": "publicKey"
          },
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "tokenAccount",
            "type": "publicKey"
          },
          {
            "name": "redeemable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "lootbox",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintOne",
            "type": "publicKey"
          },
          {
            "name": "mintTwo",
            "type": "publicKey"
          },
          {
            "name": "mintThree",
            "type": "publicKey"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "InitUserParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "switchboardStateBump",
            "type": "u8"
          },
          {
            "name": "vrfPermissionBump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidVrfAuthorityError",
      "msg": "Switchboard VRF Account's authority should be set to the client's state pubkey"
    },
    {
      "code": 6001,
      "name": "InvalidVrfAccount",
      "msg": "Invalid VRF account provided."
    },
    {
      "code": 6002,
      "name": "AlreadyRedeemed",
      "msg": "Already Redeemed"
    }
  ]
};
