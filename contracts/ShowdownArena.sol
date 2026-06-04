// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

contract ShowdownArena {
    enum Status {
        None,
        Open,
        SettledA,
        SettledB
    }

    struct Showdown {
        uint256 id;
        bytes32 externalId;
        string marketId;
        string marketQuestion;
        address agentA;
        string agentNameA;
        bool sideAYes;
        uint16 agentAProbabilityBps;
        address agentB;
        string agentNameB;
        uint16 agentBProbabilityBps;
        uint256 bondPerSideMicroUsdc;
        uint64 deadline;
        uint64 openedAt;
        uint64 settledAt;
        Status status;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public showdownCount;
    mapping(uint256 => Showdown) public showdowns;
    mapping(bytes32 => uint256) public externalIdToId;

    event ShowdownOpened(
        uint256 indexed showdownId,
        bytes32 indexed externalId,
        string marketId,
        address indexed agentA,
        bool sideAYes,
        address agentB,
        uint256 bondPerSideMicroUsdc,
        uint64 deadline
    );

    event ShowdownSettled(
        uint256 indexed showdownId,
        Status indexed result,
        address indexed winner,
        uint256 payoutMicroUsdc
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(address usdcAddress, address treasuryAddress) {
        require(usdcAddress != address(0), "usdc required");
        require(treasuryAddress != address(0), "treasury required");

        usdc = IERC20(usdcAddress);
        owner = msg.sender;
        treasury = treasuryAddress;
    }

    function openShowdown(
        bytes32 externalId,
        string calldata marketId,
        string calldata marketQuestion,
        address agentA,
        string calldata agentNameA,
        bool sideAYes,
        uint16 agentAProbabilityBps,
        address agentB,
        string calldata agentNameB,
        uint16 agentBProbabilityBps,
        uint256 bondPerSideMicroUsdc,
        uint64 deadline
    ) external onlyOwner returns (uint256 showdownId) {
        uint64 openedAt = uint64(block.timestamp);

        require(externalIdToId[externalId] == 0, "external id reused");
        require(agentA != address(0) && agentB != address(0), "zero agent");
        require(agentA != agentB, "agents must differ");
        require(bondPerSideMicroUsdc > 0, "bond required");
        require(deadline > openedAt, "deadline in past");

        showdownId = showdownCount + 1;
        showdownCount = showdownId;
        externalIdToId[externalId] = showdownId;
        showdowns[showdownId] = Showdown({
            id: showdownId,
            externalId: externalId,
            marketId: marketId,
            marketQuestion: marketQuestion,
            agentA: agentA,
            agentNameA: agentNameA,
            sideAYes: sideAYes,
            agentAProbabilityBps: agentAProbabilityBps,
            agentB: agentB,
            agentNameB: agentNameB,
            agentBProbabilityBps: agentBProbabilityBps,
            bondPerSideMicroUsdc: bondPerSideMicroUsdc,
            deadline: deadline,
            openedAt: openedAt,
            settledAt: 0,
            status: Status.Open
        });

        require(usdc.transferFrom(agentA, address(this), bondPerSideMicroUsdc), "transferFrom A failed");
        require(usdc.transferFrom(agentB, address(this), bondPerSideMicroUsdc), "transferFrom B failed");

        emit ShowdownOpened(
            showdownId,
            externalId,
            marketId,
            agentA,
            sideAYes,
            agentB,
            bondPerSideMicroUsdc,
            deadline
        );
    }

    function settleShowdown(uint256 showdownId, bool agentAWins) external onlyOwner {
        Showdown storage showdown = showdowns[showdownId];
        require(showdown.status == Status.Open, "not open");

        showdown.status = agentAWins ? Status.SettledA : Status.SettledB;
        showdown.settledAt = uint64(block.timestamp);

        address winner = agentAWins ? showdown.agentA : showdown.agentB;
        uint256 payoutMicroUsdc = showdown.bondPerSideMicroUsdc * 2;

        require(usdc.transfer(winner, payoutMicroUsdc), "payout failed");

        emit ShowdownSettled(showdownId, showdown.status, winner, payoutMicroUsdc);
    }

    function getShowdown(uint256 showdownId) external view returns (Showdown memory) {
        return showdowns[showdownId];
    }

    function lookupByExternalId(bytes32 externalId) external view returns (uint256) {
        return externalIdToId[externalId];
    }
}
