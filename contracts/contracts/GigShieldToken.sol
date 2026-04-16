// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GigShieldToken {
    string public name = "GigShield Token";
    string public symbol = "GST";
    uint8 public immutable decimals = 18;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error InvalidAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    constructor(address initialOwner) {
        address resolvedOwner = initialOwner == address(0) ? msg.sender : initialOwner;
        owner = resolvedOwner;
        emit OwnershipTransferred(address(0), resolvedOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert InvalidAddress();
        }
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address accountOwner, address spender) external view returns (uint256) {
        return _allowances[accountOwner][spender];
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance < value) {
            revert InsufficientAllowance();
        }
        unchecked {
            _approve(from, msg.sender, currentAllowance - value);
        }
        _transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 amount) external onlyOwner returns (bool) {
        _mint(to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0) || to == address(0)) {
            revert InvalidAddress();
        }
        uint256 fromBalance = _balances[from];
        if (fromBalance < value) {
            revert InsufficientBalance();
        }
        unchecked {
            _balances[from] = fromBalance - value;
        }
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    function _approve(address accountOwner, address spender, uint256 value) internal {
        if (accountOwner == address(0) || spender == address(0)) {
            revert InvalidAddress();
        }
        _allowances[accountOwner][spender] = value;
        emit Approval(accountOwner, spender, value);
    }

    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
