import { Button, VStack, Text, HStack, Image, Spacer } from "@chakra-ui/react"
import { ArrowForwardIcon } from "@chakra-ui/icons"
import {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { PublicKey } from "@solana/web3.js"
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
  const [stakeStatus, setStakeStatus] = useState(false)

  const workspace = useWorkspace()
  const program = workspace.program

  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const metaplex = useMemo(() => {
    return Metaplex.make(connection)
  }, [])

  const fetchNfts = async () => {
    const nft = (await metaplex
      .nfts()
      .load({ metadata: props.nft })
      .run()) as Nft

    const tokenAccount = (
      await connection.getTokenLargestAccounts(props.nft.mintAddress)
    ).value[0].address

    setNftData(nft)

    if (program && publicKey) {
      let [stakeStatePda] = await PublicKey.findProgramAddress(
        [publicKey?.toBuffer(), tokenAccount.toBuffer()],
        program.programId
      )

      // check if NFT staked
      try {
        let stakeStateAccount = await program?.account.userStakeInfo.fetch(
          stakeStatePda
        )
        console.log(Object.keys(stakeStateAccount.stakeState))
        if (
          (Object.keys(stakeStateAccount.stakeState) as unknown as string) ==
          "staked"
        ) {
          setStakeStatus(true)
        }
      } catch (error: unknown) {}
    }
  }

  const stake: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (program && publicKey) {
        const nft = (await metaplex
          .nfts()
          .load({ metadata: props.nft })
          .run()) as Nft
        // console.log(nft)

        const tokenAccount = (
          await connection.getTokenLargestAccounts(props.nft.mintAddress)
        ).value[0].address

        // console.log(tokenAccount.toString())

        let delegatedAuthPda = await PublicKey.findProgramAddress(
          [Buffer.from("authority")],
          program.programId
        )

        let stakeStatePda = await PublicKey.findProgramAddress(
          [publicKey.toBuffer(), tokenAccount.toBuffer()],
          program.programId
        )

        const transaction = await program?.methods
          .stake()
          .accounts({
            // user: publicKey,
            nftTokenAccount: tokenAccount,
            nftMint: props.nft.mintAddress,
            nftEdition: nft.edition.address,
            // stakeState: stakeStatePda[0],
            programAuthority: delegatedAuthPda[0],
            // tokenProgram: TOKEN_PROGRAM_ID,
            metadataProgram: METADATA_PROGRAM_ID,
            // systemProgram: SystemProgram.programId,
          })
          .transaction()

        const transactionSignature = await sendTransaction(
          transaction,
          connection
        )

        console.log("Stake tx:")
        console.log(
          `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
        )

        setStakeStatus(true)
      }
    },
    []
  )

  const unstake: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (program && publicKey) {
        const nft = (await metaplex
          .nfts()
          .load({ metadata: props.nft })
          .run()) as Nft
        // console.log(nft)

        const tokenAccount = (
          await connection.getTokenLargestAccounts(props.nft.mintAddress)
        ).value[0].address

        // console.log(tokenAccount.toString())

        let delegatedAuthPda = await PublicKey.findProgramAddress(
          [Buffer.from("authority")],
          program.programId
        )

        let stakeStatePda = await PublicKey.findProgramAddress(
          [publicKey.toBuffer(), tokenAccount.toBuffer()],
          program.programId
        )

        const transaction = await program?.methods
          .unstake()
          .accounts({
            // user: publicKey,
            nftTokenAccount: tokenAccount,
            nftMint: props.nft.mintAddress,
            nftEdition: nft.edition.address,
            // stakeState: stakeStatePda[0],
            // programAuthority: delegatedAuthPda[0],
            // tokenProgram: TOKEN_PROGRAM_ID,
            metadataProgram: METADATA_PROGRAM_ID,
          })
          .transaction()

        const transactionSignature = await sendTransaction(
          transaction,
          connection
        )

        console.log("Unstake tx:")
        console.log(
          `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
        )

        setStakeStatus(false)
      }
    },
    []
  )

  const redeem: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (program && publicKey) {
        const nft = (await metaplex
          .nfts()
          .load({ metadata: props.nft })
          .run()) as Nft
        // console.log(nft)

        const tokenAccount = (
          await connection.getTokenLargestAccounts(props.nft.mintAddress)
        ).value[0].address

        // console.log(tokenAccount.toString())

        let delegatedAuthPda = await PublicKey.findProgramAddress(
          [Buffer.from("authority")],
          program.programId
        )

        let stakeStatePda = await PublicKey.findProgramAddress(
          [publicKey.toBuffer(), tokenAccount.toBuffer()],
          program.programId
        )

        let mint = new PublicKey("EEvAqBfznnTzpQqRu74t2X4uYkqTzASJ7zsaP2J2vX2q")

        let tokenAddress = await getAssociatedTokenAddress(mint, publicKey)

        const transaction = await program.methods
          .redeem()
          .accounts({
            // user: wallet.publicKey,
            nftTokenAccount: tokenAccount,
            // stakeState: stakeStatePda,
            stakeMint: mint,
            // stakeAuthority: mintAuth,
            userStakeAta: tokenAddress,
            // tokenProgram: TOKEN_PROGRAM_ID,
          })
          .transaction()

        const transactionSignature = await sendTransaction(
          transaction,
          connection
        )

        console.log("Redeem tx:")
        console.log(
          `https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
        )
      }
    },
    []
  )

  useEffect(() => {
    fetchNfts()
  }, [])

  return (
    <VStack alignItems="center">
      {nftData && (
        <Image
          key={props.nft.address}
          borderRadius="md"
          boxSize="250px"
          src={nftData.json?.image}
          alt=""
        />
      )}
      {!stakeStatus ? (
        <Button bgColor="accent" color="white" maxW="380px" onClick={stake}>
          <HStack>
            <Text>stake my buildoor</Text>
          </HStack>
        </Button>
      ) : (
        <VStack>
          <Button bgColor="accent" color="white" maxW="380px" onClick={unstake}>
            <HStack>
              <Text>unstake my buildoor</Text>
            </HStack>
          </Button>

          <Button bgColor="accent" color="white" maxW="380px" onClick={redeem}>
            <HStack>
              <Text>redeem $BLD</Text>
            </HStack>
          </Button>
        </VStack>
      )}
    </VStack>
  )
}

export default StakeStatus