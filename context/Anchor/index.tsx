import { createContext, useContext, useEffect, useState } from "react"
import {
  Program,
  AnchorProvider,
  Idl,
  setProvider,
} from "@project-serum/anchor"
import { AnchorNftStaking, IDL as StakingIDL } from "./anchor_nft_staking"
import { Lootbox, IDL as LootboxIDL } from "./lootbox"
import { Connection, PublicKey } from "@solana/web3.js"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import MockWallet from "./MockWallet"
import {
  STAKING_PROGRAM_ID,
  LOOTBOX_PROGRAM_ID,
  SBV2_DEVNET_PID,
} from "../../utils/constants"
import {
  AnchorWallet,
  loadSwitchboardProgram,
  OracleQueueAccount,
  PermissionAccount,
  ProgramStateAccount,
  VrfAccount,
} from "@switchboard-xyz/switchboard-v2"

const WorkspaceContext = createContext({})

interface WorkSpace {
  connection?: Connection
  provider?: AnchorProvider
  programStaking?: Program<AnchorNftStaking>
  programLootbox?: Program<Lootbox>
  programSwitchboard?: Program
}

const WorkspaceProvider = ({ children }: any) => {
  const wallet = useAnchorWallet() || MockWallet
  const { connection } = useConnection()

  const provider = new AnchorProvider(connection, wallet, {})
  setProvider(provider)

  const programStaking = new Program(StakingIDL as Idl, STAKING_PROGRAM_ID)
  const programLootbox = new Program(LootboxIDL as Idl, LOOTBOX_PROGRAM_ID)

  async function getIDL() {
    const IDL = await Program.fetchIdl(SBV2_DEVNET_PID, provider)
    return IDL
  }

  const SwitchboardIDL = getIDL()
  const programSwitchboard = new Program(
    SwitchboardIDL as unknown as Idl,
    SBV2_DEVNET_PID
  )

  // // Alternative
  // const switchboardProgram = await loadSwitchboardProgram(
  //   "devnet",
  //   connection,
  //   ((provider as AnchorProvider).wallet as AnchorWallet).payer
  // )

  const workspace = {
    connection,
    provider,
    programStaking,
    programLootbox,
    programSwitchboard,
  }

  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  )
}

const useWorkspace = (): WorkSpace => {
  return useContext(WorkspaceContext)
}

export { WorkspaceProvider, useWorkspace }
