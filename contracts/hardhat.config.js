require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
        },
    },
    networks: {
        hardhat: {},
        // Ethereum Sepolia (chain 11155111)
        ethSepolia: {
            url: process.env.ETH_SEPOLIA_RPC_URL || "https://ethereum-sepolia.publicnode.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111,
        },
        // Base Sepolia (chain 84532) — kept for reference
        baseSepolia: {
            url: "https://sepolia.base.org",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 84532,
        },
        mainnet: {
            url: process.env.MAINNET_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: {
            sepolia:     process.env.ETHERSCAN_API_KEY || "",
            ethSepolia:  process.env.ETHERSCAN_API_KEY || "",
            baseSepolia: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "ethSepolia",
                chainId: 11155111,
                urls: {
                    apiURL:     "https://api-sepolia.etherscan.io/api",
                    browserURL: "https://sepolia.etherscan.io",
                },
            },
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL:     "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
        ],
    },
    paths: {
        sources: "./src",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};
