const { logger } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { betLimitModel, transactionModel, userModel, casinoBetModel } = require('../models');
const axios = require('axios');
const moment = require('moment');
const randomstring = require('randomstring');
const LOG_ID = 'services/betGamesService';
const constant = require('../../config/default.json');
const { query } = require('../utils/mongodbQuery');
const mongoose = require('mongoose');
const { userDao } = require('../dao');
const { generatePokerToken } = require('../utils/tokenGenerator');
const pLimit = require('p-limit');
const limit = pLimit(100);


exports.auth = async (reqBody) => {
  try {
    const operatorId = process.env.OPERATOR_ID;

    if (!reqBody.token) {
      return {
        success: false,
        message: 'Token and Operator ID are required.',
      };
    }
    const decoded = jwt.verify(reqBody.token, process.env.JWT_SECRET)
    const userId = decoded.userId;
    const user = await userModel.findOne({ _id: userId });
    console.log('user', user);
    if (!user) {
      return {
        success: false,
        message: 'Player not found.',
      };
    }

    if (!user.status === 'active') {
      return {
        success: false,
        message: 'Account Inactive, contact upline.',
      };
    }

    const pokerToken = generatePokerToken({
      userId: userId,
      name: user.username,
      role: user.role,
      // operatorId,
    });

    return {
      operatorId: parseInt(operatorId, 10),
      userId: user._id,
      username: user.username,
      playerTokenAtLaunch: pokerToken,
      token: user.token,
      balance: user.totalBalance || 0,
      exposure: user.exposer || 0,
      currency: user.currency || 'INR',
      language: 'en',
      timestamp: Date.now().toString(),
      clientIP: reqBody.clientIP || ['0.0.0.0'],
      VIP: user.VIP || '0',
      errorCode: 0,
      errorDescription: 'ok',
    };
  } catch (error) {
    console.log(error)
    return {
      success: false,
      message: 'Something went wrong.',
    };
  }
};


// const betLimits = {
//     INR: { minBet: 500, maxBet: 200000, maxMarketPL: 600000 },
//     HKD: { minBet: 10, maxBet: 2000, maxMarketPL: 6000 },
//   };

exports.exposure = async (reqBody) => {
  try {
    const {
      token,
      gameId,
      matchName,
      roundId,
      marketId,
      marketType,
      userId,
      calculateExposure,
      betInfo,
      runners,
      exposureTime,
    } = reqBody;

    if (
      !token ||
      !gameId ||
      !matchName ||
      !roundId ||
      !marketId ||
      !marketType ||
      !userId ||
      !calculateExposure ||
      !betInfo ||
      !runners ||
      !exposureTime
    ) {
      return {
        status: 1,
        message: 'Missing required fields.',
      };
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return {
        status: 401,
        message: 'Invalid or expired token.',
      };
    }

    if (decoded.userId !== userId) {
      return {
        status: 1,
        message: 'Token user mismatch.',
      };
    }

    const user = await userModel.findOne({ _id: userId });
    if (!user || user.status !== 'active') {
      return {
        status: 1,
        message: 'User account is inactive or not found.',
      };
    }


    const userCurrency = user.currency || 'INR';
    const betLimits = await BetLimits.findOne();
    if (!betLimits) {
      return {
        status: 1,
        message: 'Bet limits not found.',
      };
    }

    const limits = betLimits[userCurrency];
    if (!limits) {
      return {
        status: 1,
        message: `Bet limits for the currency ${userCurrency} not found.`,
      };
    }

    if (betInfo.reqStake < limits.minBet || betInfo.reqStake > limits.maxBet) {
      return {
        status: 1,
        message: `Stake should be between ${limits.minBet} and ${limits.maxBet} ${userCurrency}.`,
      };
    }

    const newMarketExposure = user.exposer + calculateExposure;
    if (Math.abs(newMarketExposure) > limits.maxMarketPL) {
      return {
        status: 1,
        message: `Market profit/loss limit exceeded (${limits.maxMarketPL} ${userCurrency}).`,
      };
    }

    const newBalance = user.totalBalance - Math.abs(calculateExposure);
    if (newBalance < 0) {
      return {
        status: 1,
        message: 'Insufficient balance.',
      };
    }

    const existingBet = await casinoBetModel.findOne({ marketId, userId }).sort({ createdAt: -1 });
    if (existingBet && exposureTime <= existingBet.exposureTime) {
      return {
        status: 0,
        message: 'Exposure not updated as it is older than the last calculated exposure.',
        wallet: user.totalBalance,
        exposure: user.exposer,
      };
    }

    const newBet = new casinoBetModel({
        token,
        gameId,
        matchName,
        roundId,
        marketId,
        marketType,
        userId: mongoose.Types.ObjectId(userId),
        calculateExposure,
        exposureTime,
        betInfo,
        runners,
    });

    const savedBet = await newBet.save();

    user.exposer = newMarketExposure;
    user.totalBalance = newBalance;
    await user.save();

    const tranRes = await userTransactionForPoker(marketId, userId, calculateExposure, newBalance);

    if (!tranRes.success) {
      return {
        status: 1,
        message: 'Error recording transaction for exposure update.',
      };
    }

    return {
      status: 0,
      message: 'Exposure updated successfully.',
      wallet: newBalance,
      exposure: newMarketExposure,
    };
  } catch (error) {
    console.error('Error in /api/poker/exposure:', error);
    return {
      status: 1,
      message: 'Internal server error.',
    };
  }
};

exports.updateResults = async (reqBody) => {
  try {
    const { result, runners, betvoid, roundId, market } = reqBody;

    if (!result || !roundId || !market) {
      return {
        status: 1,
        message: "Missing required fields",
      };
    }

    const updatedUsers = [];

    for (const userResult of result) {
      const { userId, marketId, downpl, wallet: currentWallet, exposure: currentExposure } = userResult;

      const user = await userModel.findOne({ _id: userId });

      if (!user) {
        console.log(`User not found: ${userId}`);
        continue;
      }

      user.totalBalance = currentWallet + downpl;
      user.exposer = currentExposure - downpl;
      await user.save();

      const transactionId = generateTransactionId();
      const transactionData = {
        userId,
        transactionType: downpl > 0 ? 'credit' : 'debit',
        amount: Math.abs(downpl),
        currentMainWallet: user.totalBalance,
        description: `Result update for market ${marketId}`,
        previousMainWallet: currentWallet,
        transactionId,
        status: 'confirm',
        type: 'casino-result',
      };

      await transactionModel.create(transactionData);

      updatedUsers.push({
        userId,
        wallet: user.totalBalance,
        exposure: user.exposer,
      });

      if (user.createdBy) {
        const creator = await userModel.findById(new mongoose.Types.ObjectId(user.createdBy));
        if (creator) {
          const handleCommission = async (amount, type) => {
            const tranidCommission = generateTransactionId();
            const transactiondata = {
              userId: creator._id,
              transactionType: 'credit',
              amount: parseInt(amount),
              currentMainWallet: Number(creator.totalBalance || 0) + Number(amount),
              description: `${type} Bet Commission Fee`,
              previousMainWallet: Number(creator.totalBalance || 0),
              transactionId: tranidCommission,
              status: 'confirm',
              type: 'commission',
            };

            await userModel.findOneAndUpdate(
              { _id: creator._id },
              { $inc: { commissionBalance: amount, totalBalance: amount } },
              { new: true }
            );
            await transactionModel.create(transactiondata);
          };

          if (creator.rollingCommission?.casino && userResult.isBack && bet.type === 'bookmakers') {
            const amount = (Math.abs(downpl) * creator.rollingCommission.casino) / 100;
            await handleCommission(amount, 'Casino');
          }

        }
      }
    }

    if (betvoid) {
      await casinoBetModel.updateMany(
        { marketId: market.marketId, roundId },
        { status: "voided" }
      );

      return {
        status: 0,
        message: "Market voided successfully",
      };
    }

    if (runners && runners.length) {
      await marketModel.updateOne(
        { _id: market.marketId },
        { $set: { runners, status: "CLOSED" } }
      );
    }

    return {
      status: 1,
      message: "Users' profit/loss updated successfully",
      result: updatedUsers,
    };
  } catch (error) {
    console.error("Error in updateResults:", error);
    return {
      status: 1,
      message: "Internal server error",
    };
  }
};


exports.refund = async (reqBody) => {
  try {
    const {
      token,
      gameId,
      matchName,
      roundId,
      marketId,
      marketType,
      userId,
      exposureTime,
      calculateExposure,
      betInfo,
    } = req.body;

    if (!token || !userId || !marketId || !exposureTime || !betInfo) {
      return res.json({
        status: 1,
        message: "Missing required fields",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.json({
        status: 1,
        message: "User not found",
      });
    }

    const existingBet = await betModel.findOne({ 'betInfo.orderId': betInfo.orderId });
    if (!existingBet) {
      return res.json({
        status: 1,
        message: "Bet not found",
      });
    }

    if (exposureTime > existingBet.exposureTime) {
      user.totalBalance -= betInfo.betExposure;
      user.exposer -= betInfo.betExposure;

      const transactionId = generateTransactionId();
      const transactionData = {
        userId,
        transactionType: 'debit',
        amount: betInfo.betExposure,
        currentMainWallet: user.totalBalance,
        description: `Refund for bet ${betInfo.orderId} in market ${marketId}`,
        previousMainWallet: user.totalBalance + betInfo.betExposure,
        transactionId,
        status: 'confirm',
        type: 'refund',
      };

      await transactionModel.create(transactionData);
      await user.save();

      await betModel.updateOne(
        { 'betInfo.orderId': betInfo.orderId },
        { $set: { 'betInfo.status': 'CANCELLED', 'betInfo.pl': 0 } }
      );

      return res.json({
        status: 0,
        Message: "success",
        wallet: user.totalBalance,
        exposure: user.exposer,
      });
    } else {
      return res.json({
        status: 0,
        Message: "Exposure time is outdated, no changes made",
        wallet: user.totalBalance,
        exposure: user.exposer,
      });
    }
  } catch (error) {
    console.error('Error in refund API:', error);
    return res.json({
      status: 1,
      message: 'Internal server error',
    });
  }
};




const userTransactionForPoker = async (marketId, userId, calculateExposure, balance) => {
  try {

    const tranid = generateTransactionId();

    const transactiondata = {
      userId,
      transactionType: calculateExposure > 0 ? 'credit' : 'debit',
      amount: Math.abs(calculateExposure),
      currentMainWallet: balance,
      description: `Exposure update for market ${marketId}`,
      previousMainWallet: balance + calculateExposure,
      transactionId: tranid,
      status: 'confirm',
      type: 'casino-exposure',
    };

    await transactionModel.create(transactiondata);

    return { success: true, message: 'Transaction recorded successfully' };
  } catch (error) {
    console.error('Error creating transaction for exposure:', error);
    return { success: false, message: 'Error creating transaction for exposure' };
  }
};

const generateTransactionId = () => {
  const randomStr = randomstring.generate({ charset: 'alphanumeric', length: 4 });
  return `${constant.APP_SHORT_NAME}-${Date.now()}-${randomStr}`;
};
