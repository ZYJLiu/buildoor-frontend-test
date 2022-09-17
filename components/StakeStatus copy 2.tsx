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
} from "@chakra-ui/react"
import { ArrowForwardIcon } from "@chakra-ui/icons"
import {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { PublicKey, StakeInstruction, Transaction } from "@solana/web3.js"
import { getAssociatedTokenAddress } from "@solana/spl-token"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Metaplex, Nft } from "@metaplex-foundation/js"
import { PROGRAM_ID as METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata"
import { useWorkspace } from "../context/Anchor"
import { token } from "@project-serum/anchor/dist/cjs/utils"

export interface Props {
  nft: any
}

const StakeStatus: FC<Props> = (props) => {
  // console.log(props.nft)
  // console.log(props.nft.address.toString())

  const [nftData, setNftData] = useState<Nft>()
  const [stakeAccountAddress, setStakeAccountAddress] = useState<PublicKey>()
  const [tokenAccountAddress, setTokenAccountAddress] = useState<PublicKey>()
  const [delegateAuthorityAddress, setDelegateAuthorityAddress] =
    useState<PublicKey>()
  const stakeRewardMint = new PublicKey(
    "398X9iYckL5xfMRi6uEGmSRX5ACWAmPmFe7j7pLEcxkL"
  )

  const [stakeStatus, setStakeStatus] = useState(false)
  const [loading, setLoading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()

  const workspace = useWorkspace()
  const program = workspace.program

  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const metaplex = useMemo(() => {
    return Metaplex.make(connection)
  }, [])

  const fetchNft = async () => {
    const nft = (await metaplex
      .nfts()
      .load({ metadata: props.nft })
      .run()) as Nft

    const tokenAccount = (
      await connection.getTokenLargestAccounts(props.nft.mintAddress)
    ).value[0].address

    setNftData(nft)
    console.log(nft)
    setTokenAccountAddress(tokenAccount)

    if (program && publicKey) {
      const [stakeStatePDA] = await PublicKey.findProgramAddress(
        [publicKey?.toBuffer(), tokenAccount.toBuffer()],
        program.programId
      )

      const [delegatedAuthPDA] = await PublicKey.findProgramAddress(
        [Buffer.from("authority")],
        program.programId
      )
      setStakeAccountAddress(stakeStatePDA)
      setDelegateAuthorityAddress(delegatedAuthPDA)
    }
  }

  const checkStakeStatus = async () => {
    if (program && stakeAccountAddress) {
      try {
        const stakeStateAccount = await program.account.userStakeInfo.fetch(
          stakeAccountAddress
        )
        console.log(Object.keys(stakeStateAccount.stakeState))
        if (
          (Object.keys(stakeStateAccount.stakeState) as unknown as string) ==
          "staked"
        ) {
          setStakeStatus(true)
        } else {
          setStakeStatus(false)
        }
      } catch (error: unknown) {}
    }
  }

  const sendAndConfirmTransaction = async (transaction: Transaction) => {
    const transactionSignature = await sendTransaction(transaction, connection)

    onOpen()

    const latestBlockHash = await connection.getLatestBlockhash()

    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: transactionSignature,
    })

    onClose()

    console.log("Stake tx:")
    console.log(
      `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )

    checkStakeStatus()
  }

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
          programAuthority: delegateAuthorityAddress,
          // tokenProgram: TOKEN_PROGRAM_ID,
          metadataProgram: METADATA_PROGRAM_ID,
          // systemProgram: SystemProgram.programId,
        })
        .instruction()

      return instruction
    }
  }

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

  const createRedeemInstruction = async () => {
    if (program && publicKey) {
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

  const stake: MouseEventHandler<HTMLButtonElement> = useCallback(async () => {
    const stakeInstruction = await createStakeInstruction()
    const transaction = new Transaction().add(stakeInstruction!)
    sendAndConfirmTransaction(transaction)
  }, [])

  const redeem: MouseEventHandler<HTMLButtonElement> = useCallback(async () => {
    const redeemInstruction = await createRedeemInstruction()
    const transaction = new Transaction().add(redeemInstruction!)
    sendAndConfirmTransaction(transaction)
  }, [])

  const unstake: MouseEventHandler<HTMLButtonElement> =
    useCallback(async () => {
      const redeemInstruction = await createRedeemInstruction()
      const unstakeInstruction = await createUnstakeInstruction()
      const transaction = new Transaction().add(
        redeemInstruction!,
        unstakeInstruction!
      )
      sendAndConfirmTransaction(transaction)
    }, [])

  useEffect(() => {
    fetchNft()
  }, [])

  useEffect(() => {
    checkStakeStatus()
  }, [stakeAccountAddress])

  return (
    <VStack
      alignItems="center"
      width="300px"
      height="375px"
      backgroundColor="white"
      boxShadow="0px 4px 9px rgba(0, 0, 0, 0.25)"
      borderRadius="8px"
    >
      {nftData && (
        <Image
          key={props.nft.address}
          borderRadius="md"
          boxSize="250px"
          margin="10px"
          src={nftData.json?.image}
          alt=""
        />
      )}
      {!stakeStatus ? (
        <Button
          width="200px"
          height="35px"
          bgColor="accent"
          color="white"
          onClick={stake}
        >
          <HStack>
            <Text>Stake Buildoor</Text>
          </HStack>
        </Button>
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
