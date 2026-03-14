const { ethers } = require("hardhat");

/** Small helper — waits ms milliseconds */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

    // ── 1. DeployRegistry ─────────────────────────────────────────
    console.log("\n📦 Deploying DeployRegistry...");
    const DeployRegistry = await ethers.getContractFactory("DeployRegistry");
    const registry = await DeployRegistry.deploy(deployer.address);
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();
    console.log("✅ DeployRegistry deployed to:", registryAddr);
    await wait(3000); // let the node settle

    // ── 2. IPNSRegistry ───────────────────────────────────────────
    console.log("\n📦 Deploying IPNSRegistry...");
    const IPNSRegistry = await ethers.getContractFactory("IPNSRegistry");
    const ipns = await IPNSRegistry.deploy(deployer.address);
    await ipns.waitForDeployment();
    const ipnsAddr = await ipns.getAddress();
    console.log("✅ IPNSRegistry deployed to:", ipnsAddr);
    await wait(3000);

    // ── 3. SubnameRegistry ────────────────────────────────────────
    console.log("\n📦 Deploying SubnameRegistry...");
    const claimFee = ethers.parseEther("0");   // Free on launch
    const maxLabelLength = 32n;
    const SubnameRegistry = await ethers.getContractFactory("SubnameRegistry");
    const subnames = await SubnameRegistry.deploy(deployer.address, claimFee, maxLabelLength);
    await subnames.waitForDeployment();
    const subnamesAddr = await subnames.getAddress();
    console.log("✅ SubnameRegistry deployed to:", subnamesAddr);
    await wait(3000);

    // ── 4. AccessController ───────────────────────────────────────
    console.log("\n📦 Deploying AccessController...");
    const AccessController = await ethers.getContractFactory("AccessController");
    const access = await AccessController.deploy(deployer.address);
    await access.waitForDeployment();
    const accessAddr = await access.getAddress();
    console.log("✅ AccessController deployed to:", accessAddr);

    // ── Summary ───────────────────────────────────────────────────
    console.log("\n────────────────────────────────────────────────────────");
    console.log("🚀 All contracts deployed!");
    console.log("────────────────────────────────────────────────────────");
    console.log(`DeployRegistry    : ${registryAddr}`);
    console.log(`IPNSRegistry      : ${ipnsAddr}`);
    console.log(`SubnameRegistry   : ${subnamesAddr}`);
    console.log(`AccessController  : ${accessAddr}`);
    console.log("────────────────────────────────────────────────────────");
    console.log("\nAdd these to your .env / GitHub Actions variables:");
    console.log(`REGISTRY_CONTRACT=${registryAddr}`);
    console.log(`IPNS_REGISTRY_CONTRACT=${ipnsAddr}`);
    console.log(`SUBNAME_REGISTRY=${subnamesAddr}`);
    console.log(`ACCESS_CONTROLLER=${accessAddr}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
