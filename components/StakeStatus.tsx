import {
  Button,
  VStack,
  Text,
  HStack,
  Image,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Center,
  Heading,
} from "@chakra-ui/react"
import {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { PublicKey, Transaction } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Metaplex, Nft } from "@metaplex-foundation/js"
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata"
import { useWorkspace } from "../context/Anchor"

export interface Props {
  nft: any
}

const StakeStatus: FC<Props> = (props) => {
  const stakeRewardMint = new PublicKey(
    "398X9iYckL5xfMRi6uEGmSRX5ACWAmPmFe7j7pLEcxkL"
  )
  const [stakeAccountAddress, setStakeAccountAddress] = useState<PublicKey>()
  const [stakeState, setStakeState] = useState<any>()
  const [stakeRewards, setStakeRewards] = useState(0)
  const [tokenAccountAddress, setTokenAccountAddress] = useState<PublicKey>()
  const [nftData, setNftData] = useState<Nft>()

  const [stakeStatus, setStakeStatus] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const workspace = useWorkspace()
  const program = workspace.program

  const metaplex = useMemo(() => {
    return Metaplex.make(connection)
  }, [])

  // function to fetch NFT data and derive stateState account PDAs used for staking
  const fetchNft = async () => {
    // use metaplex to load all data associated to the NFT (need edition address for staking/unstaking)
    const nft = (await metaplex
      .nfts()
      .load({ metadata: props.nft })
      .run()) as Nft

    // find the token address currently holding the NFT
    const tokenAccount = (
      await connection.getTokenLargestAccounts(props.nft.mintAddress)
    ).value[0].address

    setNftData(nft)
    setTokenAccountAddress(tokenAccount)

    if (program && publicKey) {
      // derive stakeState account PDA
      const [stakeStatePDA] = await PublicKey.findProgramAddress(
        [publicKey.toBuffer(), tokenAccount.toBuffer()],
        program.programId
      )

      setStakeAccountAddress(stakeStatePDA)
    }
  }

  // check stake status of NFT
  const checkStakeStatus = async () => {
    if (program && stakeAccountAddress) {
      try {
        // fetch stakeState account data
        const stakeStateAccount = await program.account.userStakeInfo.fetch(
          stakeAccountAddress
        )
        console.log(Object.keys(stakeStateAccount.stakeState))

        // set staking status
        if (
          (Object.keys(stakeStateAccount.stakeState) as unknown as string) ==
          "staked"
        ) {
          setStakeStatus(true)
        } else {
          setStakeStatus(false)
        }

        setStakeState(stakeStateAccount)
      } catch (error: unknown) {}
    }
  }

  // check accumlated staking rewards
  const checkStakeRewards = async () => {
    if (stakeState) {
      // get current solana clock time
      const slot = await connection.getSlot({ commitment: "confirmed" })
      const timestamp = await connection.getBlockTime(slot)

      // calculate accumulated staking rewards
      setStakeRewards(timestamp! - stakeState.lastStakeRedeem.toNumber())
    }
  }

  // helper function to send and confirm transaction
  const sendAndConfirmTransaction = async (transaction: Transaction) => {
    try {
      // send transaction
      const transactionSignature = await sendTransaction(
        transaction,
        connection
      )

      // open loading modal
      onOpen()

      // wait for transaction confirmation
      // using "finalized" otherwise switching between staking / unstaking sometimes doesn't work
      const latestBlockHash = await connection.getLatestBlockhash()
      await connection.confirmTransaction(
        {
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: transactionSignature,
        },
        "finalized"
      )

      // close loading modal once transaction confirmation finalized
      onClose()

      console.log("Stake tx:")
      console.log(
        `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
      )

      // check status of stateState, which determines which buttons display
      checkStakeStatus()
    } catch (error) {}
  }

  // instruction to stake NFT
  // accounts commented out are accounts Anchor can infer using the IDL
  const createStakeInstruction = async () => {
    if (program && nftData) {
      const instruction = await program.methods
        .stake()
        .accounts({
          // user: publicKey,
          nftTokenAccount: tokenAccountAddress,
          nftMint: nftData.mint.address,
          nftEdition: nftData.edition.address,
          // stakeState: stakeStatePda[0],
          // programAuthority: delegateAddress,
          // tokenProgram: TOKEN_PROGRAM_ID,
          metadataProgram: METADATA_PROGRAM_ID,
          // systemProgram: SystemProgram.programId,
        })
        .instruction()

      return instruction
    }
  }

  // instruction to unstake NFT
  // accounts commented out are accounts Anchor can infer using the IDL
  const createUnstakeInstruction = async () => {
    if (program && nftData) {
      const instruction = await program.methods
        .unstake()
        .accounts({
          // user: publicKey,
          nftTokenAccount: tokenAccountAddress,
          nftMint: nftData.mint.address,
          nftEdition: nftData.edition.address,
          // stakeState: stakeStatePda[0],
          // programAuthority: delegatedAuthPda[0],
          // tokenProgram: TOKEN_PROGRAM_ID,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .instruction()
      return instruction
    }
  }

  // instruction to redeem staking rewards
  // accounts commented out are accounts Anchor can infer using the IDL
  const createRedeemInstruction = async () => {
    if (program && publicKey) {
      // get the user's token address for staking rewards
      const stakeRewardTokenAddress = await getAssociatedTokenAddress(
        stakeRewardMint,
        publicKey
      )

      const instruction = await program.methods
        .redeem()
        .accounts({
          // user: wallet.publicKey,
          nftTokenAccount: tokenAccountAddress,
          // stakeState: stakeStatePda,
          stakeMint: stakeRewardMint,
          // stakeAuthority: mintAuth,
          userStakeAta: stakeRewardTokenAddress,
          // tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()

      return instruction
    }
  }

  // send transaction to stake NFT
  const stake: MouseEventHandler<HTMLButtonElement> = useCallback(async () => {
    const stakeInstruction = await createStakeInstruction()
    sendAndConfirmTransaction(new Transaction().add(stakeInstruction!))
  }, [nftData])

  // send transaction to redeem staking rewards
  const redeem: MouseEventHandler<HTMLButtonElement> = useCallback(async () => {
    const redeemInstruction = await createRedeemInstruction()
    sendAndConfirmTransaction(new Transaction().add(redeemInstruction!))
  }, [nftData])

  // send transaction to redeem staking rewards and then unstake NFT
  const unstake: MouseEventHandler<HTMLButtonElement> =
    useCallback(async () => {
      const redeemInstruction = await createRedeemInstruction()
      const unstakeInstruction = await createUnstakeInstruction()
      sendAndConfirmTransaction(
        new Transaction().add(redeemInstruction!, unstakeInstruction!)
      )
    }, [nftData])

  // fetch NFT data on load
  useEffect(() => {
    fetchNft()
  }, [])

  // check the stake status if stakeAccountAddress changes (should only run on load, after fetchNFT)
  useEffect(() => {
    checkStakeStatus()
  }, [stakeAccountAddress])

  // check the stake rewards if statStatus is true, otherwise set stakeRewards to 0
  // run if stateStatus or stakeState changes
  useEffect(() => {
    if (stakeStatus) {
      const interval = setInterval(() => {
        checkStakeRewards()
        // setStakeRewards((stakeRewards) => stakeRewards + 1)
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setStakeRewards(0)
    }
  }, [stakeStatus, stakeState])

  return (
    <VStack
      alignItems="center"
      width="300px"
      height="425px"
      backgroundColor="white"
      boxShadow="0px 4px 9px rgba(0, 0, 0, 0.25)"
      borderRadius="8px"
    >
      {nftData && (
        <VStack>
          <Heading size="md">{nftData.name}</Heading>
          <Image
            borderRadius="md"
            boxSize="250px"
            margin="10px"
            src={nftData.json?.image}
            alt=""
          />
        </VStack>
      )}
      <Text as="b">$BLD Rewards: {stakeRewards}</Text>
      {!stakeStatus ? (
        <VStack>
          <Button
            width="200px"
            height="35px"
            bgColor="accent"
            color="white"
            onClick={stake}
          >
            <Text>Stake Buildoor</Text>
          </Button>
        </VStack>
      ) : (
        <VStack>
          <Button
            width="200px"
            height="35px"
            bgColor="accent"
            color="white"
            onClick={unstake}
          >
            <HStack>
              <Text>Unstake Buildoor</Text>
            </HStack>
          </Button>

          <Button
            width="200px"
            height="35px"
            bgColor="accent"
            color="white"
            onClick={redeem}
          >
            <HStack>
              <Text>Redeem $BLD</Text>
            </HStack>
          </Button>
        </VStack>
      )}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent width="275px" height="150px">
          <ModalHeader>Waiting Confirmation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Center>
              <Spinner
                thickness="10px"
                speed="1.5s"
                emptyColor="gray.200"
                color="blue.500"
                size="xl"
              />
            </Center>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  )
}

export default StakeStatus
