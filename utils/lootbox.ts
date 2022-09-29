import * as anchor from "@project-serum/anchor"
// import * as anchor from "anchor-24-2";
import * as spl from "@solana/spl-token-v2"
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Signer,
  SystemProgram,
  SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js"
import { promiseWithTimeout, sleep } from "@switchboard-xyz/sbv2-utils"
import {
  Callback,
  OracleQueueAccount,
  packTransactions,
  PermissionAccount,
  ProgramStateAccount,
  programWallet,
  VrfAccount,
} from "@switchboard-xyz/switchboard-v2"
import { loadSwitchboard, loadVrfContext } from "./switchboard"
