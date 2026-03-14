const { expect } = require("chai");
const { ethers } = require("hardhat");

// ══════════════════════════════════════════════════════════════════════════════
// DeployRegistry
// ══════════════════════════════════════════════════════════════════════════════

describe("DeployRegistry", function () {
    let registry;
    let owner, deployer1, deployer2;

    beforeEach(async function () {
        [owner, deployer1, deployer2] = await ethers.getSigners();
        const DeployRegistry = await ethers.getContractFactory("DeployRegistry");
        registry = await DeployRegistry.deploy(owner.address);
    });

    describe("logDeploy", function () {
        it("logs a production deploy and emits Deployed", async function () {
            const cid = ethers.toUtf8Bytes("bafybeig3abc");
            const tx = await registry.connect(deployer1).logDeploy(
                "myapp.eth", cid, "production", "commit:abc123"
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(
                (l) => l.fragment && l.fragment.name === "Deployed"
            );
            expect(event).to.exist;

            const deploy = await registry.getDeploy("myapp.eth", 0);
            expect(deploy.deployer).to.equal(deployer1.address);
            expect(deploy.env).to.equal("production");
            expect(ethers.toUtf8String(deploy.cid)).to.equal("bafybeig3abc");
        });

        it("accepts staging and preview environments", async function () {
            const cid = ethers.toUtf8Bytes("bafybeighijkl");
            await registry.connect(deployer1).logDeploy("myapp.eth", cid, "staging", "");
            await registry.connect(deployer1).logDeploy("myapp.eth", cid, "preview", "");
            expect(await registry.deployCount("myapp.eth")).to.equal(2n);
        });

        it("reverts on invalid environment name", async function () {
            const cid = ethers.toUtf8Bytes("bafybeighijkl");
            await expect(
                registry.connect(deployer1).logDeploy("myapp.eth", cid, "live", "")
            ).to.be.revertedWithCustomError(registry, "InvalidEnv");
        });

        it("reverts on empty CID", async function () {
            await expect(
                registry.connect(deployer1).logDeploy("myapp.eth", "0x", "production", "")
            ).to.be.revertedWithCustomError(registry, "EmptyCID");
        });

        it("reverts on empty domain", async function () {
            const cid = ethers.toUtf8Bytes("bafybeig");
            await expect(
                registry.connect(deployer1).logDeploy("", cid, "production", "")
            ).to.be.revertedWithCustomError(registry, "EmptyDomain");
        });
    });

    describe("history reads", function () {
        beforeEach(async function () {
            const cid = ethers.toUtf8Bytes("bafybeig");
            await registry.connect(deployer1).logDeploy("myapp.eth", cid, "production", "v1");
            await registry.connect(deployer2).logDeploy("myapp.eth", cid, "staging", "v2");
            await registry.connect(deployer1).logDeploy("myapp.eth", cid, "preview", "v3");
        });

        it("deployCount returns correct total", async function () {
            expect(await registry.deployCount("myapp.eth")).to.equal(3n);
        });

        it("getLatestDeploy returns the newest entry", async function () {
            const latest = await registry.getLatestDeploy("myapp.eth");
            expect(latest.env).to.equal("preview");
        });

        it("getDeployHistory returns newest-first", async function () {
            const hist = await registry.getDeployHistory("myapp.eth", 0, 10);
            expect(hist.length).to.equal(3);
            expect(hist[0].env).to.equal("preview");
            expect(hist[2].env).to.equal("production");
        });

        it("getAllDomains includes deployed domain", async function () {
            const domains = await registry.getAllDomains();
            expect(domains).to.include("myapp.eth");
        });
    });

    describe("allowlists", function () {
        it("blocks non-allowlisted deployer once allowlist is enabled", async function () {
            await registry.connect(owner).enableAllowlist("secure.eth", [deployer1.address]);
            const cid = ethers.toUtf8Bytes("bafybeig");
            await expect(
                registry.connect(deployer2).logDeploy("secure.eth", cid, "production", "")
            ).to.be.revertedWithCustomError(registry, "NotAuthorized");
        });

        it("allows allowlisted deployer", async function () {
            await registry.connect(owner).enableAllowlist("secure.eth", [deployer1.address]);
            const cid = ethers.toUtf8Bytes("bafybeig");
            await expect(
                registry.connect(deployer1).logDeploy("secure.eth", cid, "production", "")
            ).to.not.be.reverted;
        });
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// IPNSRegistry
// ══════════════════════════════════════════════════════════════════════════════

describe("IPNSRegistry", function () {
    let ipns;
    let owner, publisher1, publisher2;

    const DOMAIN = "myapp.eth";
    const IPNS_KEY = ethers.toUtf8Bytes("k51qzi5uqu5myipnskey");
    const CID_1 = ethers.toUtf8Bytes("bafybeig3cid1");
    const CID_2 = ethers.toUtf8Bytes("bafybeig3cid2");
    const GATEWAYS = ["https://dweb.link", "https://cloudflare-ipfs.com"];

    beforeEach(async function () {
        [owner, publisher1, publisher2] = await ethers.getSigners();
        const IPNSRegistry = await ethers.getContractFactory("IPNSRegistry");
        ipns = await IPNSRegistry.deploy(owner.address);
    });

    describe("register", function () {
        it("registers an IPNS key and emits event", async function () {
            await expect(
                ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, GATEWAYS)
            ).to.emit(ipns, "IPNSKeyRegistered");

            expect(await ipns.isRegistered(DOMAIN)).to.be.true;

            const entry = await ipns.getEntry(DOMAIN);
            expect(ethers.toUtf8String(entry.ipnsKey)).to.equal("k51qzi5uqu5myipnskey");
            expect(entry.active).to.be.true;
        });

        it("reverts on duplicate registration", async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, []);
            await expect(
                ipns.connect(publisher2).register(DOMAIN, IPNS_KEY, CID_1, [])
            ).to.be.revertedWithCustomError(ipns, "DomainAlreadyRegistered");
        });

        it("reverts on empty IPNS key", async function () {
            await expect(
                ipns.connect(publisher1).register(DOMAIN, "0x", CID_1, [])
            ).to.be.revertedWithCustomError(ipns, "InvalidIPNSKey");
        });

        it("records initial CID update when provided", async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, []);
            expect(await ipns.updateCount(DOMAIN)).to.equal(1n);
            const [cid] = await ipns.getLatest(DOMAIN);
            expect(ethers.toUtf8String(cid)).to.equal("bafybeig3cid1");
        });

        it("stores and returns gateways", async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, GATEWAYS);
            const gws = await ipns.getGateways(DOMAIN);
            expect(gws).to.deep.equal(GATEWAYS);
        });
    });

    describe("logIPNSUpdate", function () {
        beforeEach(async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, []);
        });

        it("logs a new IPNS update with increasing sequence", async function () {
            await expect(
                ipns.connect(publisher1).logIPNSUpdate(DOMAIN, CID_2, 1n)
            ).to.emit(ipns, "IPNSUpdated");

            const [cid, seq] = await ipns.getLatest(DOMAIN);
            expect(ethers.toUtf8String(cid)).to.equal("bafybeig3cid2");
            expect(seq).to.equal(1n);
            expect(await ipns.updateCount(DOMAIN)).to.equal(2n); // initial + this
        });

        it("reverts on non-monotonic sequence", async function () {
            await ipns.connect(publisher1).logIPNSUpdate(DOMAIN, CID_2, 5n);
            await expect(
                ipns.connect(publisher1).logIPNSUpdate(DOMAIN, CID_2, 3n)
            ).to.be.revertedWithCustomError(ipns, "SequenceNotMonotonic");
        });

        it("reverts on empty CID", async function () {
            await expect(
                ipns.connect(publisher1).logIPNSUpdate(DOMAIN, "0x", 1n)
            ).to.be.revertedWithCustomError(ipns, "InvalidCID");
        });

        it("reverts for unauthorised publisher", async function () {
            await expect(
                ipns.connect(publisher2).logIPNSUpdate(DOMAIN, CID_2, 1n)
            ).to.be.revertedWithCustomError(ipns, "NotAuthorised");
        });

        it("allows additional authorised publisher after setPublisher", async function () {
            await ipns.connect(owner).setPublisher(DOMAIN, publisher2.address, true);
            await expect(
                ipns.connect(publisher2).logIPNSUpdate(DOMAIN, CID_2, 1n)
            ).to.not.be.reverted;
        });
    });

    describe("update history", function () {
        beforeEach(async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, []);
            await ipns.connect(publisher1).logIPNSUpdate(DOMAIN, CID_2, 1n);
        });

        it("getUpdateHistory returns correct order", async function () {
            const hist = await ipns.getUpdateHistory(DOMAIN, 0, 10);
            expect(hist.length).to.equal(2);
            expect(ethers.toUtf8String(hist[0].cid)).to.equal("bafybeig3cid1");
            expect(ethers.toUtf8String(hist[1].cid)).to.equal("bafybeig3cid2");
        });

        it("pagination works correctly", async function () {
            const hist = await ipns.getUpdateHistory(DOMAIN, 1, 1);
            expect(hist.length).to.equal(1);
            expect(ethers.toUtf8String(hist[0].cid)).to.equal("bafybeig3cid2");
        });
    });

    describe("deregister", function () {
        it("owner can deregister a domain", async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, []);
            await ipns.connect(owner).deregister(DOMAIN);
            expect(await ipns.isRegistered(DOMAIN)).to.be.false;
        });

        it("non-owner cannot deregister", async function () {
            await ipns.connect(publisher1).register(DOMAIN, IPNS_KEY, CID_1, []);
            await expect(
                ipns.connect(publisher1).deregister(DOMAIN)
            ).to.be.revertedWithCustomError(ipns, "OwnableUnauthorizedAccount");
        });
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// SubnameRegistry
// ══════════════════════════════════════════════════════════════════════════════

describe("SubnameRegistry", function () {
    let subnames;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        const SubnameRegistry = await ethers.getContractFactory("SubnameRegistry");
        subnames = await SubnameRegistry.deploy(owner.address, 0n, 32n);
    });

    describe("claim", function () {
        it("claims a valid label and sets owner", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            const sub = await subnames.getSubname("myproject");
            expect(sub.owner).to.equal(user1.address);
            expect(sub.active).to.be.true;
        });

        it("reverts on duplicate claim", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            await expect(
                subnames.connect(user2).claim("myproject", "0x", "")
            ).to.be.revertedWithCustomError(subnames, "LabelAlreadyClaimed");
        });

        it("reverts on label with uppercase character", async function () {
            await expect(
                subnames.connect(user1).claim("MyProject", "0x", "")
            ).to.be.revertedWithCustomError(subnames, "InvalidLabel");
        });

        it("reverts on leading hyphen", async function () {
            await expect(
                subnames.connect(user1).claim("-bad", "0x", "")
            ).to.be.revertedWithCustomError(subnames, "InvalidLabel");
        });

        it("reverts when fee not met", async function () {
            await subnames.connect(owner).setClaimFee(ethers.parseEther("0.01"));
            await expect(
                subnames.connect(user1).claim("myproject", "0x", "")
            ).to.be.revertedWithCustomError(subnames, "InsufficientFee");
        });

        it("accepts claim with exact fee", async function () {
            await subnames.connect(owner).setClaimFee(ethers.parseEther("0.01"));
            await expect(
                subnames.connect(user1).claim("myproject", "0x", "", {
                    value: ethers.parseEther("0.01"),
                })
            ).to.not.be.reverted;
        });
    });

    describe("updateCID", function () {
        it("owner can update CID", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            const newCid = ethers.toUtf8Bytes("bafybeig3newcid");
            await subnames.connect(user1).updateCID("myproject", newCid, "");
            const sub = await subnames.getSubname("myproject");
            expect(ethers.toUtf8String(sub.cid)).to.equal("bafybeig3newcid");
        });

        it("non-owner cannot update CID", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            await expect(
                subnames.connect(user2).updateCID("myproject", "0x01", "")
            ).to.be.revertedWithCustomError(subnames, "NotSubnameOwner");
        });
    });

    describe("transfer", function () {
        it("owner can transfer subname", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            await subnames.connect(user1).transfer("myproject", user2.address);
            const sub = await subnames.getSubname("myproject");
            expect(sub.owner).to.equal(user2.address);
        });
    });

    describe("admin", function () {
        it("owner can revoke a subname", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            await subnames.connect(owner).revoke("myproject");
            const sub = await subnames.getSubname("myproject");
            expect(sub.active).to.be.false;
        });

        it("revoked label can be re-claimed", async function () {
            await subnames.connect(user1).claim("myproject", "0x", "");
            await subnames.connect(owner).revoke("myproject");
            await expect(
                subnames.connect(user2).claim("myproject", "0x", "")
            ).to.not.be.reverted;
        });
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// AccessController
// ══════════════════════════════════════════════════════════════════════════════

describe("AccessController", function () {
    let access;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        const AccessController = await ethers.getContractFactory("AccessController");
        access = await AccessController.deploy(owner.address);
    });

    describe("PUBLIC policy", function () {
        it("grants access to everyone", async function () {
            await access.connect(owner).setPolicyPublic("myapp.eth");
            expect(await access.checkAccess("myapp.eth", user1.address)).to.be.true;
            expect(await access.checkAccess("myapp.eth", user2.address)).to.be.true;
        });
    });

    describe("ALLOWLIST policy", function () {
        beforeEach(async function () {
            await access.connect(owner).setPolicyAllowlist("myapp.eth", [user1.address]);
        });

        it("grants access to allowlisted user", async function () {
            expect(await access.checkAccess("myapp.eth", user1.address)).to.be.true;
        });

        it("denies access to non-allowlisted user", async function () {
            expect(await access.checkAccess("myapp.eth", user2.address)).to.be.false;
        });

        it("grants access after being added", async function () {
            await access.connect(owner).setAllowlisted("myapp.eth", user2.address, true);
            expect(await access.checkAccess("myapp.eth", user2.address)).to.be.true;
        });
    });

    describe("PAUSED policy", function () {
        it("denies all access when paused", async function () {
            await access.connect(owner).setPolicyPublic("myapp.eth");
            await access.connect(owner).pause("myapp.eth");
            expect(await access.checkAccess("myapp.eth", user1.address)).to.be.false;
        });

        it("restores access after unpause", async function () {
            await access.connect(owner).setPolicyPublic("myapp.eth");
            await access.connect(owner).pause("myapp.eth");
            await access.connect(owner).unpause("myapp.eth", 0); // 0 = PUBLIC
            expect(await access.checkAccess("myapp.eth", user1.address)).to.be.true;
        });
    });

    describe("uninitialised domain", function () {
        it("reverts with PolicyNotInitialised", async function () {
            await expect(
                access.checkAccess("unknown.eth", user1.address)
            ).to.be.revertedWithCustomError(access, "PolicyNotInitialised");
        });
    });
});
