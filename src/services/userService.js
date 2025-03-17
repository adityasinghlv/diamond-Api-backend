
const { userModel, loginHistory, roleModel, betMatchModel, referCodeModel,casinoLogsModel, userBetModel, UserGameStatusModel, gameModel,qrDetailModel,bankDetailsModel,upiDetailsModel,cryptoDetailModel,withdrawModel ,transactionModel,userCommissionReportModel,pictureModel,passwordChangeHistory} = require('../models');
const { generateAuthToken } = require('../utils/tokenGenerator');
const { logger } = require('../utils/logger');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const { roles, userStatus, rolesKeys, APP_SHORT_NAME } = require('../../config/default.json');
const { userDao } = require('../dao');
const { query } = require('../utils/mongodbQuery');
const axios = require('axios');
const { default: mongoose } = require('mongoose');
var randomstring = require('randomstring');
const LOG_ID = 'services/userServices';
const  constants = require('../config/default.json');
const path = require('path');
const fs = require('fs');
const geoip = require("geoip-lite");

exports.genrateReferCode = async (str) => {
    const char = String(str).substring(0, 4);
    const coupon = randomstring.generate({
        charset: 'alphanumeric',
        length: 4
    });
    let referCode = `${APP_SHORT_NAME}-${char.toUpperCase()}${coupon.toUpperCase()}`;
    const checkReferCode = await userModel.findOne({ refer_code: referCode });
    if (checkReferCode) {
        await this.genrateReferCode(str);
    }
    return referCode;
};
function validateWithdrawalRequest(reqBody, requiredFields) {
    const missingFields = [];
    requiredFields.forEach((field) => {
        if (!reqBody[field]) {
            missingFields.push(field);
        }
    });

    if (missingFields.length > 0) {
        const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
        return { isValid: false, error: errorMessage };
    }
    return { isValid: true };
}
exports.saveLogginHistory = async (userId, loginMethod, country = '', ipAddress = '') => {
    try {
        const geo = geoip.lookup(ipAddress);
        const loginData = {
            userId,
            login_method: loginMethod,
            country:geo?.country||"IN",
            ip_address: ipAddress,
            city:geo?.city||""
        };

        const savedData = await loginHistory.create(loginData);
        return {
            status: true,
            message: 'Login history saved!',
            data: savedData
        };
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: 'Error while saving login history!',
            error: error.message || 'Unknown error'
        };
    }
};
exports.getLogginHistory = async ({ userId, page = 1, perPage = 10, fromDate, toDate }) => {
  try {
      if (!userId) {
          return {
              success: false,
              message: "User ID is required.",
          };
      }

      page = Number(page) || 1;
      perPage = Number(perPage) || 10;

      let matchFilter = { userId : new mongoose.Types.ObjectId(userId) };

      if (fromDate || toDate) {
          matchFilter.createdAt = {};
          if (fromDate) matchFilter.createdAt.$gte = moment(fromDate).startOf("day").toDate();
          if (toDate) matchFilter.createdAt.$lte = moment(toDate).endOf("day").toDate();
      }

      const agg = [
          { $match: matchFilter },
          {
              $lookup: {
                  from: "users", 
                  localField: "userId",
                  foreignField: "_id",
                  as: "userDetails"
              }
          },
          { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } }, 
          {
              $facet: {
                  "pagination": [
                      {
                          $group: {
                              _id: null,
                              totalCount: { $sum: 1 }
                          }
                      },
                      {
                          $addFields: {
                              page,
                              perPage
                          }
                      },
                      {
                          $project: {
                              _id: 0,
                              totalCount: 1,
                              totalPages: {
                                  $ceil: { $divide: ["$totalCount", { $ifNull: [perPage, 10] }] }
                              },
                              page,
                              perPage
                          }
                      }
                  ],
                  "fetchDetails": [
                      { $sort: { createdAt: -1 } },
                      { $skip: (page - 1) * perPage },
                      { $limit: perPage },
                      {
                          $project: {
                              _id: 1,
                              userId: 1,
                              username: "$userDetails.username", 
                              ip_address: 1,
                              city: 1,
                              country: 1,
                              createdAt: 1
                          }
                      }
                  ]
              }
          },
          { $unwind: "$pagination" },
          {
              $project: {
                  pagination: 1,
                  fetchDetails: 1
              }
          }
      ];

      const data = await loginHistory.aggregate(agg);

      if (data.length > 0 && data[0].fetchDetails.length > 0) {
          return {
              success: true,
              message: "Login history fetched successfully!",
              data: data[0].fetchDetails,
              pagination: data[0].pagination
          };
      }

      return {
          success: false,
          message: "No login history found!",
          data: []
      };

  } catch (error) {
      console.error("Error fetching login history:", error);
      return {
          success: false,
          message: "Error while fetching login history!",
          error: error.message || "Unknown error"
      };
  }
};
exports.login = async (reqBody) => {
    try {
        const { username, password, ipAddress, country } = reqBody;

        const usernameLower = username.toLowerCase();

        const findUser = await userModel.findOne(
            { username: usernameLower },
            { _id: 1, password: 1 ,role_name : 1,firstTime :1,status:1}
        ).lean();
       

        if (!findUser) {
            return {
                success: false,
                message: 'User not found'
            };
        }
        if (findUser.status === 'suspended') {
            return {
                success: false,
                message: 'Your account has been suspended. Please contact your upline!.'
            };
        }
       
        if (findUser.role_name !== 'user'){
            return {
                success: false,
                message: 'User role not valid'
            };
        }

       
        const isPasswordValid = await bcrypt.compare(password, findUser.password);
        if (!isPasswordValid) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }

      
        const user = await userModel.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(findUser._id)
                }
            },
            {
                $addFields: {
                    availablePoints: {
                        $sum: ['$openingBalance', '$profitLossBalance']
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { usersId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$createdBy', '$$usersId']
                                }
                            }
                        },
                        {
                            $addFields: {
                                availablePoints: {
                                    $sum: ['$openingBalance', '$profitLossBalance']
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                res: { $sum: '$availablePoints' }
                            }
                        }
                    ],
                    as: 'downLevelBalance'
                }
            },
            {
                $addFields: {
                    downLevelBalance: {
                        $ifNull: [
                            { $arrayElemAt: ['$downLevelBalance.res', 0] },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    token: 0
                }
            }
        ]);

        if (user.length === 0) {
            return {
                success: false,
                message: 'User not found'
            };
        }


        const token = generateAuthToken({
            userId: findUser._id,
            name: findUser.name,
            role: findUser.role,
            _id: findUser._id
        });
        let upadateData = {
            token: token
       }
       
        if (!findUser.firstTime) {
            upadateData.firstTime = false;
        }
       
        await userModel.updateOne({ _id: findUser._id }, { ...upadateData });
        
        await this.saveLogginHistory(findUser._id, 'Login', country || '', ipAddress || '');

        return {
            success: true,
            message: 'Logged in successfully',
            user: user[0],
            token
        };
    } catch (error) {
        console.log(error);
        logger.error(LOG_ID, `Error occurred during login: ${error}`);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};

exports.createDemoUser = async (req, res) => {
  try {
  
    const randomUsername = `demoUser${Math.floor(1000 + Math.random() * 9000)}`;
    const randomPassword = `Admin${Math.floor(1000 + Math.random() * 9000)}`;
    const randomMobile = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    const existingUser = await userModel.findOne({ username: randomUsername });
    if (existingUser) {
      return {
        success: false,
        message: "Generated username already exists. Try again.",
      };
    }

    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const demoUser = new userModel({
      username: randomUsername,
      name: randomUsername,
      roleId: "67c6d795a1e009d7938c562e",
      commission: 0,
      openingBalance: 100000,
      totalBalance: 100000,
      creditReference: 100000,
      mobileNumber: randomMobile,
      password: hashedPassword,
      rollingCommission: {
        fancy: "0",
        matka: "0",
        casino: "0",
        binary: "0",
        sportbook: "0",
        bookmaker: "0",
      },
      exposureLimit: 100000,
      partnership: 0,
      createdBy: null,
      role_name: "user",
      accountType: "demo-user",

    });

    const token = generateAuthToken({
      userId: demoUser._id,
      name: demoUser.name,
      role:  demoUser.role,
      _id: demoUser._id
    });
    demoUser.token = token;

    await demoUser.save();

    

    return {
      success: true,
      message: "Demo user created successfully",
      token,
      user: {
        _id: demoUser._id,
        username: demoUser.username,
        // password: randomPassword, 
        mobileNumber: demoUser.mobileNumber,
        role: demoUser.roleId,
        exposer: demoUser.exposer,
        totalBalance: demoUser.totalBalance,
        country: demoUser?.country||"",
        role_name: demoUser?.role_name||"",
        accountType: demoUser?.accountType||""
      },
    };
  } catch (error) {
    console.log(error)
    return {
      success: false,
      message: error.message || resMessage.Server_error,
    };
  }
};

exports.registerUser = async (auth, body) => {
    try {
        const { roleId, username, email, mobileNumber, createdBy, password, country, ipAddress } = body;

        const usernameLower = username.toLowerCase();

        const role = await roleModel.findById(roleId);
        if (!role) {
            return {
                success: false,
                message: 'Please provide a valid role.'
            };
        }

        const userNameExst = await userModel.findOne({ username: usernameLower });
        if (userNameExst) {
            return {
                success: false,
                message: 'This username is already taken.'
            };
        }

        if (!email && !mobileNumber) {
            return {
                success: false,
                message: 'Please provide email or phone number.'
            };
        }

        const query = {};
        if (email) query.email = email;
        if (mobileNumber) query.mobileNumber = mobileNumber;

        const exUser = await userModel.findOne(query);
        if (exUser) {
            return {
                success: false,
                message: exUser.email === email
                    ? 'This email is already taken. Please choose a different one.'
                    : 'This phone number is already taken. Please choose a different one.'
            };
        }

        if (createdBy) {
            const parentUser = await userModel.findOne({ _id: createdBy, status: userStatus.active });
            if (!parentUser) {
                return {
                    success: false,
                    message: 'Parent user not found.'
                };
            }
        }

        const salt = bcrypt.genSaltSync(10);
        body.password = await bcrypt.hashSync(password, salt);

        const getReferCode = await this.genrateReferCode(usernameLower || '');
        body.refer_code = getReferCode;
        body.totalBalance = 0;
        body.openingBalance = 0;
        body.role = roleId;

        // Store username in lowercase
        body.username = usernameLower;

        let insertUser = await userModel.create(body);
        if (insertUser) {
            delete insertUser._doc.password;
            const response = { insertUser };
            const referCodeData = await referCodeModel.find({ refer_code: getReferCode });
            const referLink = `https://${APP_SHORT_NAME}.io/i-${getReferCode}-n`;

            if (referCodeData.length === 0) {
                await referCodeModel.create({
                    userId: insertUser._id,
                    referCode: getReferCode,
                    referLink: referLink
                });
            }

            await this.saveLogginHistory(
                insertUser._id,
                'Registration',
                country || '',
                ipAddress || ''
            );

            return {
                success: true,
                message: `${usernameLower} created successfully.`,
                data: response
            };
        } else {
            return {
                success: false,
                message: 'Error while inserting user.'
            };
        }

    } catch (error) {
        console.log(error);
        logger.error(LOG_ID, `Error occurred during registerUser: ${error}`);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};

exports.uesrProfile = async ({ userId: userId }) => {
    try {

        const user = await userModel.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $lookup: {
                    from: 'roles',
                    localField: "roleId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                role_name: 1
                            }
                        }
                    ],
                    as: 'role'
                }
            },
            {
                $unwind: {
                    path: '$role',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    availableBalance: {
                        $subtract: [
                           '$totalBalance',
                            { $ifNull: ['$exposer', 0] } 
                        ]
                    },
                    roleName: { $ifNull: ["$role.role_name", ""] }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { usersId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$createdBy', '$$usersId']
                                }
                            }
                        },
                        {
                            $addFields: {
                                availablePoints: {
                                    $sum: ['$totalBalance', '$profitLossBalance']
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                res: { $sum: '$availablePoints' }
                            }
                        }
                    ],
                    as: 'downLevelBalance'
                }
            },
            {
                $addFields: {
                    downLevelBalance: {
                        $ifNull: [
                            { $arrayElemAt: ['$downLevelBalance.res', 0] },
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    totalExposer: { $ifNull: ["$exposer" , 0]}
                }
            },
            {
                $project: {
                    password: 0,
                    token: 0,
                    
                }
            },
            {
              $addFields: {
                betBidValue: { $slice: ["$betBidValue", 8] }
              }
            }
            
        ]);
        
        if (user.length == 0) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        return {
            success: true,
            message: `Profile of ${user[0].name} fetched successfully.`,
            data: user[0]
        };
    } catch (error) {
        console.log(error)
        logger.error(LOG_ID,
            `Error occurred during fetching user profile: ${error}`
        );
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};
exports.getGames = async ({ userId }) => {
    try {

        const userGame = await gameModel.find();


        if (userGame.length == 0) {
            return {
                success: false,
                message: 'User game not found'
            };
        }

        return {
            success: true,
            message: `User games fetched successfully.`,
            userGame: userGame
        };
    } catch (error) {
        logger.error(LOG_ID,
            `Error occurred during fetching user games: ${error}`
        );
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};
exports.getGamesNoAuth = async () => {
    try {

        const userGame = await gameModel.find();


        if (userGame.length == 0) {
            return {
                success: false,
                message: 'User game not found'
            };
        }

        return {
            success: true,
            message: `User games fetched successfully.`,
            userGame: userGame
        };
    } catch (error) {
        logger.error(LOG_ID,
            `Error occurred during fetching user games: ${error}`
        );
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};
exports.getDemoUser = async () => {
    try {
        const data = {
            'username': 'john_d234',
            'password': 'User@123'
        };
        const findUser = await userModel.findOne({ username: data.username, status: userStatus.active }, { _id: 1, password: 1 });
        if (!findUser) {
            return {
                success: false,
                message: 'User not found'
            };
        }
        const isPasswordValid = await bcrypt.compare(data.password, findUser.password);
        if (!isPasswordValid) {
            return {
                success: false,
                message: 'Invalid credentials'
            };
        }
        const updateBal = await userModel.findOneAndUpdate({ _id: findUser._id }, { openingBalance: 1500 }, { new: true });
        const { data: userData } = await this.uesrProfile({ userId: findUser._id });

        const token = generateAuthToken({
            userId: findUser._id,
            name: userData.name,
            role: userData.role,
            _id: findUser._id,
            stockUserId: findUser.stockUserId
        });

        await userModel.updateOne({ _id: findUser._id }, { token });
        return {
            success: true,
            message: 'You have successfully logged in to your demo account',
            data: userData,
            token,
            demoDetails: data
        };
    } catch (error) {
        logger.error(LOG_ID, `Error occurred during fetching game report: ${error}`);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};
exports.changePassword = async ({ previousPassword, password, cnf_password, userId, _id }) => {
    try {
        if (password !== cnf_password) {
            return {
                success: false,
                message: 'Your password does not match.'
            };
        }

        const user = await userModel.findOne({
            _id: userId,
            status: userStatus.active
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

       
        const isPreviousPasswordValid = await bcrypt.compare(previousPassword, user.password);
        if (!isPreviousPasswordValid) {
            return {
                success: false,
                message: 'old password is incorrect.'
            };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (isPasswordValid) {
            return {
                success: false,
                message: 'Please choose a new password different from your old password.'
            };
        }

       
        const salt = bcrypt.genSaltSync(10);
        const hash = await bcrypt.hashSync(password, salt);

      
        const updatedUser = await userModel.updateOne({ _id: userId }, { password: hash , firstTime: false  });

        
        const history = new passwordChangeHistory({
          userId: userId,
          changedBy: _id ? _id : userId, 
          remarks: "Password Changed By Self.",
      });
        await history.save();


        if (updatedUser.modifiedCount > 0) {
            return {
                success: true,
                message: 'Password changed successfully.',
                data: {
                    username: user.username,
                    userId
                }
            };
        }

        return {
            success: false,
            message: 'Failed to update password. Please try again.',
            error: true
        };

    } catch (error) {
        logger.error(LOG_ID, `Error occurred during changing user password: ${error}`);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};

exports.saveUserPaymentDetails = async (req, body) => {
    try {
        const { flag, userId, displayName ,typename,file} = body;
        let requiredFields;
        let data;
        

        const validatePaymentDetails = (fields) => {
            const validationFlag = validateWithdrawalRequest(body, fields);
            if (!validationFlag.isValid) {
                return {
                    success: false,
                    message: validationFlag.error,
                    data: {}
                };
            }
            return { success: true };
        };


        switch (flag) {
            case 'QR Code':
                if (req.file?.filename) {
                    body.image = `/${req.body.typename}/${req.file.filename}`;
                }

                requiredFields = ['userId', 'image', 'displayName'];
                const qrValidation = validatePaymentDetails(requiredFields);
                if (!qrValidation.success) return qrValidation;

                data = await qrDetailModel.create(body);
                break;

            case 'Bank Transfer':
                requiredFields = ['userId', 'AccountNumber', 'bankName', 'ifscCode', 'accHolderName'];
                const bankValidation = validatePaymentDetails(requiredFields);
                if (!bankValidation.success) return bankValidation;

                data = await bankDetailsModel.create(body);
                break;

            case 'UPI':
                requiredFields = ['userId', 'upiDetails', 'displayName'];
                const upiValidation = validatePaymentDetails(requiredFields);
                if (!upiValidation.success) return upiValidation;

                data = await upiDetailsModel.create(body);
                break;

            case 'crypto':
                requiredFields = ['userId', 'network', 'displayName'];
                const cryptoValidation = validatePaymentDetails(requiredFields);
                if (!cryptoValidation.success) return cryptoValidation;

                data = await cryptoDetailModel.create(body);
                break;

            default:
                return {
                    success: false,
                    message: 'Invalid flag provided, please check the input.',
                    data: {}
                };
        }


        if (data) {
            return {
                success: true,
                message: 'Payment details created successfully.',
                data: data
            };
        }


        return {
            success: false,
            message: 'Failed to create payment details.',
            data: {}
        };

    } catch (error) {
        logger.error(LOG_ID, `Error occurred while saving payment details: ${error.message || error}`);
        return {
            success: false,
            message: 'An unexpected error occurred. Please try again later.',
            data: {}
        };
    }
};
exports.updateUserPaymentDetails = async (req, body) => {
    try {
        const { flag } = body;
        let data;
        const id = req.params.id;
        const updatePaymentDetails = async (model, id, body) => {
        
            // Ensure that the id is a valid MongoDB ObjectId (if not already)
            // if ( !( new mongoose.Types.ObjectId).isValid(id)) {
            //     return { success: false, message: "Invalid ObjectId" };
            // }
        
            // Use mongoose.Types.ObjectId to ensure the id is converted to ObjectId
            const objectId =  new mongoose.Types.ObjectId(id);  // Correct way to convert to ObjectId
        
            // Ensure that the body has the required properties
            if (!body || typeof body !== 'object') {
                return { success: false, message: "Invalid body data" };
            }
        
            // Perform the update
            try {
                const updatedData = await model.findByIdAndUpdate(objectId, body, { new: true });
                if (updatedData) {
                    return {
                        success: true,
                        message: "Document updated successfully",
                        data: updatedData
                    };
                }
                return { success: false, message: "No document found with the given ID" };
            } catch (error) {
                console.log("Error during update:", error);
                return { success: false, message: "An error occurred while updating" };
            }
        };
        

        switch (flag) {
            case 'QR Code':
                if (req.file?.filename) {
                    body.image = `/${req.body.typename}${req.file.filename}`;
                }
                data = await updatePaymentDetails(qrDetailModel, id, body);
                break;

            case 'Bank Transfer':
                data = await updatePaymentDetails(bankDetailsModel, body.id, body);
                break;

            case 'UPI':
                data = await updatePaymentDetails(upiDetailsModel, body.id, body);
                break;

            case 'crypto':
                data = await updatePaymentDetails(cryptoDetailModel, body.id, body);
                break;

            default:
                return {
                    success: false,
                    message: 'Invalid flag provided, please check the input.',
                    data: {}
                };
        }

        if (data) {
            return {
                success: true,
                message: 'Payment details updated successfully.',
                data: data
            };
        }

        return {
            success: false,
            message: 'Failed to update payment details.',
            data: {}
        };

    } catch (error) {
        console.error(error);
        logger.error(LOG_ID, `Error occurred while updating payment details: ${error.message || error}`);
        return {
            success: false,
            message: 'An unexpected error occurred. Please try again later.',
            data: {}
        };
    }
};
exports.getUserPaymentDetails = async (userId, flag, { page = 1, perPage = 10 }) => {
    try {
        // Define the models for different flag types
        const models = {
            'QR Code': qrDetailModel,
            'Bank Transfer': bankDetailsModel,
            'UPI': upiDetailsModel,
            // 'crypto': cryptoDetailModel
        };

        // Check if the flag is valid
        if (!models[flag]) {
            return {
                success: false,
                message: 'Invalid flag provided, please check the input.',
                data: {}
            };
        }

        // Convert page and perPage to numbers
        page = Number(page);
        perPage = Number(perPage);

        // Get the appropriate model based on the flag
        const model = models[flag];

        // Query the data based on userId, applying pagination
        const data = await model.find({ userId })
                                .skip(perPage * (page - 1))
                                .limit(perPage);
       const totalCount = await model.find({ userId }).countDocuments();


        // If no data found, return a message
        if (!data.length) {
            return {
                success: false,
                message: 'No details found.',
                data: []
            };
        }

        // Update image URLs if necessary
        const updatedData = data.map((e) => {
            if (e.image) {
                e.image = `${constants.BASE_URL_Without_Slas}${e.image}`;
            }
            return e;
        });

        // Pagination info
        const pagination = {
            page,
            perPage,
            totalPages: Math.ceil(totalCount / perPage),
            totalResult: totalCount
        };

        return {
            success: true,
            message: 'Successfully fetched payment details.',
            data: updatedData,
            pagination
        };

    } catch (error) {
        logger.error(
            LOG_ID,
            `Error occurred during fetching payment details: ${error.message || error}`
        );
        return {
            success: false,
            message: 'Something went wrong. Please try again later.',
            data: {}
        };
    }
};
exports.getUserWithdrawalDetails = async (userId) => {
    try {
        const pipeline = [
            {
                '$match': {
                    'userId': new mongoose.Types.ObjectId(userId)
                }
            },
            {
                '$addFields': {
                    'image': { $concat: [constants.BASE_URL_Without_Slas, '$image'] }
                }
            }
        ];

        const findUser = await userWithdrawalDetails.aggregation(pipeline);

        if (!findUser || findUser.length === 0) {
            return {
                success: false,
                message: 'User withdrawal details not found.',
                data: {}
            };
        }

        return {
            success: true,
            message: 'User withdrawal details fetched successfully.',
            data: findUser[0]
        };

    } catch (error) {
        logger.error(
            LOG_ID, 
            `Error occurred during fetching getUserWithdrawalDetails: ${error.message || error}`
        );
        return {
            success: false,
            message: 'Something went wrong.',
            data: {}
        };
    }
};
exports.depositTransactionDetails = async (userId, reqQuery) => {
    try {
        let { page = 1, perPage = 10, transactionId, chain } = reqQuery;
        page = Number(page);
        perPage = Number(perPage);

        const filter = {
            userId: mongoose.Types.ObjectId(userId),
            ...(transactionId && { transaction_id: transactionId }),
            ...(chain && { chain: chain })
        };

        const pipeline = [
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'transactions',
                    localField: 'transaction_id',
                    foreignField: 'transaction_id',
                    as: 'transaction'
                }
            },
            {
                $unwind: {
                    path: '$transaction',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    'image': { $concat: [constants.BASE_URL_Without_Slas, '$image'] }
                }
            },
            {
                $facet: {
                    pagination: [
                        {
                            $group: {
                                _id: null,
                                totalChildrenCount: { $sum: 1 }
                            }
                        },
                        {
                            $addFields: {
                                page, perPage
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                totalChildrenCount: 1,
                                totalPages: {
                                    $ceil: {
                                        $divide: ['$totalChildrenCount', perPage]
                                    }
                                },
                                page,
                                perPage
                            }
                        }
                    ],
                    fetchDetails: [
                        { $skip: (page - 1) * perPage },
                        { $limit: perPage }
                    ]
                }
            },
            {
                $unwind: '$pagination'
            },
            {
                $project: {
                    pagination: 1,
                    fetchDetails: 1
                }
            }
        ];

        const data = await query.aggregation(paymentRecord, pipeline);

        if (data.length > 0 && data[0].fetchDetails.length > 0) {
            return {
                success: true,
                message: 'Retrieved UserDeposit Successfully.',
                data: {
                    fetchDetails: data[0].fetchDetails,
                    pagination: data[0].pagination
                }
            };
        }

        return {
            success: false,
            message: 'UserDeposit details not found.',
            data: [],
            pipeline
        };

    } catch (error) {
        logger.error(LOG_ID, `Error occurred during fetching deposit transaction details: ${error.message || error}`);
        return {
            success: false,
            message: 'Something went wrong.',
            data: []
        };
    }
};

exports.getUser = async(req)=>
{ 
   try
   {
      return await userModel.find();
   }
   catch(error)
   {
     logger.error(LOG_ID, `Error occurred during fetching user: ${error.message || error}`);
     return {
        success: false,
        message: 'Something went wrong.',
        data: []
     };
   }

}

exports.passwordChangeHistory = async (req) => {
  try {
    const userId = req.auth._id;
    if (!userId) {
      return {
        success: false,
        message: "User ID is required.",
        data: [],
        pagination: {},
      };
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    let matchFilter = {
      userId: new mongoose.Types.ObjectId(userId),
      changedBy: new mongoose.Types.ObjectId(userId),
    };

    if (req.query.fromDate || req.query.toDate) {
      matchFilter.createdAt = {};
      if (req.query.fromDate) {
        matchFilter.createdAt.$gte = moment(req.query.fromDate).startOf("day").toDate();
      }
      if (req.query.toDate) {
        matchFilter.createdAt.$lte = moment(req.query.toDate).endOf("day").toDate();
      }
    }

    const aggPipeline = [
      { $match: matchFilter },
      {
        $lookup: {
          from: "users", 
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" }, 
      {
        $facet: {
          pagination: [
            {
              $group: {
                _id: null,
                totalCount: { $sum: 1 },
              },
            },
            {
              $addFields: {
                totalPages: {
                  $ceil: {
                    $divide: ["$totalCount", pageSize],
                  },
                },
                page,
                pageSize,
              },
            },
            {
              $project: {
                _id: 0,
                totalCount: 1,
                totalPages: 1,
                page: 1,
                pageSize: 1,
              },
            },
          ],
          fetchDetails: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
              $project: {
                _id: 1,
                userId: 1,
                username: "$userDetails.username", 
                changedBy: 1,
                remarks: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
      { $unwind: "$pagination" },
      {
        $project: {
          pagination: 1,
          fetchDetails: 1,
        },
      },
    ];

    const data = await passwordChangeHistory.aggregate(aggPipeline);

    if (!data.length || !data[0].fetchDetails.length) {
      return {
        success: false,
        message: "No password change history found!",
        data: [],
        pagination: {},
      };
    }

    return {
      success: true,
      message: "Password change history fetched successfully.",
      data: data[0].fetchDetails,
      pagination: data[0].pagination,
    };
  } catch (error) {
    console.error("Error fetching password change history:", error);
    return {
      success: false,
      message: "Something went wrong.",
      data: [],
      pagination: {},
    };
  }
};

exports.usercommissionreport = async (req) => {
    try {
      const data = await userCommissionReportModel.find();
      
      // Return success flag and data if fetching is successful
      return {
        success: true,
        message: 'User commission report fetched successfully.',
        data: data
      };
    } catch (error) {
      logger.error(LOG_ID, `Error occurred during fetching user commission report: ${error.message || error}`);
  
      // Return failure response if there's an error
      return {
        success: false,
        message: 'Something went wrong.',
        data: []
      };
    }
  };
  
  exports.getTransactionData = async (req) => {
    try {
        const page = parseInt(req.query.page, 10) || 1; 
        const limit = parseInt(req.query.limit, 10) || 10;
        const { startDate, endDate } = req.query;
        const skip = (page - 1) * limit;
        let userId = req.auth._id;

        const pipeline = [
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: {
                    path: '$userDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'transferedBy',
                    foreignField: '_id',
                    as: 'transferedByDetails'
                }
            },
            {
                $unwind: {
                    path: '$transferedByDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: { $in: ['deposit', 'withdraw'] }
                }
            },
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    transferedBy: 1,
                    transactionType: 1,
                    status: 1,
                    transactionId: 1,
                    amount: 1,
                    previousMainWallet: 1,
                    currentMainWallet: 1,
                    description: 1,
                    isSettlement: 1,
                    type: 1,
                    parentTransactionId: 1,
                    createdAt: 1,
                    __v: 1,
                    transferName: '$userDetails.username',
                    openingBalance: '$userDetails.openingBalance',
                    profitLossBalance: '$userDetails.profitLossBalance',
                    exposer: '$userDetails.exposer',
                    availableBalance: {
                        $subtract: [
                            { $sum: [{ $ifNull: ['$userDetails.openingBalance', 0] }, { $ifNull: ['$userDetails.profitLossBalance', 0] }] },
                            { $ifNull: ['$userDetails.exposer', 0] }
                        ]
                    },
                    from: { $ifNull: ['$transferedByDetails.username', 'Unknown'] },
                    to:{ $ifNull: ['$userDetails.username', 'Unknown'] }
                }
            }
        ];

        let matchCondition = {}; 

        if (startDate || endDate) {
            const s_Date = startDate ? new Date(startDate) : new Date(0); 
            const e_Date = endDate ? new Date(endDate) : new Date(); 
            s_Date.setHours(0, 0, 0, 0);  
            e_Date.setHours(23, 59, 59, 999);  

            matchCondition.createdAt = {
                $gte: s_Date,
                $lte: e_Date
            };
        }

        if (Object.keys(matchCondition).length > 0) {
            pipeline.push({ $match: matchCondition });
        }

        pipeline.push({
            $sort: {
                createdAt: -1
            }
        });

        pipeline.push({
            "$facet": {
                "data": [
                    { "$sort": { "createdAt": -1 } },
                    { "$skip": skip },
                    { "$limit": limit }
                ],
                "total": [
                    { "$count": "count" }
                ]
            }
        });

        pipeline.push({
            "$project": {
                "data": 1,
                "meta": {
                    "total": { "$arrayElemAt": ["$total.count", 0] },
                    "page": page,
                    "limit": limit,
                    "totalPages": {
                        "$ceil": {
                            "$divide": [
                                { "$arrayElemAt": ["$total.count", 0] },
                                limit
                            ]
                        }
                    }
                }
            }
        });

        const transactions = await transactionModel.aggregate(pipeline);

        if (transactions.length === 0) {
            return {
                success: true,
                message: 'No transactions found for the given date range.',
                data: [],
                meta: {
                    total: 0,
                    page: page,
                    limit: limit,
                    totalPages: 0
                }
            };
        }

        return {
            success: true,
            message: 'Transactions fetched successfully.',
            data: transactions[0].data,
            meta: {
                currentPage: page,
                totalPages: transactions[0].meta.totalPages,
                totalTransactions: transactions[0].meta.total,
                limit: limit
            }
        };
    } catch (error) {
        console.error("Error occurred:", error);
        return {
            success: false,
            message: 'Something went wrong.',
            data: []
        };
    }
};


exports.getProfitLossReport = async ({ page, limit, startDate, endDate,userId }, req) => {
    try {
      const filter = {}
        if(userId){
            filter._id = new mongoose.Types.ObjectId(userId);
        } else {
            filter._id = new mongoose.Types.ObjectId(req.auth._id);
        }

  
      const query = {};
      if (startDate || endDate) {
        const start = startDate ? moment(startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss'):null;
        const end = endDate ? moment(endDate).startOf('day').format('YYYY-MM-DD HH:mm:ss'):null;
  
        if (start) query.settledTime = { ...query.settledTime, $gte: start };
        if (end) query.settledTime = { ...query.settledTime, $lte: end };
      }
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      const skip = (pageNumber - 1) * limitNumber;
      
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'userbets',
            localField: '_id',
            foreignField: 'userId',
            as: 'userBets',
            pipeline: [
              { $match: query },
              {
                $addFields: {
                  profitLoss: {
                    $cond: {
                      if: { $eq: ['$result', 'WINNER'] },
                      then: '$potentialWin',
                      else: {
                        $cond: {
                          if: { $eq: ['$result', 'LOSER'] },
                          then: { $multiply: [-1, '$amount'] },
                          else: '$amount',
                        },
                      },
                    },
                  },
                },
              },
              {
                $lookup: {
                  from: 'betmatches',
                  localField: 'matchId',
                  foreignField: '_id',
                  as: 'betMatch',
                },
              },
              { $unwind: { path: '$betMatch', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  sport: '$betMatch.sport',
                  profitLoss: 1,
                  gameId:"$betMatch.gameId"
                },
              },
            ],
          },
        },
  
        { $unwind: { path: '$userBets', preserveNullAndEmptyArrays: true } },
  
        {
          $lookup: {
            from: 'usercommissionreports',
            localField: '_id',
            foreignField: 'throughId',
            as: 'userCommissionReports',
            pipeline: [
              { $match: query },
              {
                $group: {
                  _id: null,
                  totalCommission: { $sum: '$amount' },
                },
              },
            ],
          },
        },
  
        { $unwind: { path: '$userCommissionReports', preserveNullAndEmptyArrays: true } },
  
        {
          $addFields: {
            sport: '$userBets.sport',
            uplineProfitLoss: { $ifNull: ['$userBets.profitLoss', 0] },
            downlineProfitLoss: { $multiply:[{ $ifNull: ['$userBets.profitLoss', 0] },-1]},
            commission: { $ifNull: ['$userCommissionReports.totalCommission', 0] },
          },
        },
  
        {
          $project: {
            _id: 1,
            sport: 1,
            uplineProfitLoss: 1,
            downlineProfitLoss: 1,
            commission: 1,
            createdAt: 1,
          },
        },
        { $match: { sport: { $ne: null } } },
        {
          $group: {
            _id: '$sport',
            uplineProfitLoss: { $sum: '$uplineProfitLoss' },
            downlineProfitLoss: { $sum: '$downlineProfitLoss' },
            commission: { $sum: '$commission' },
          },
        },
        { $sort: { sport: 1 } },
        {
          $facet: {
            paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
            totalRecords: [{ $count: 'total' }],
          },
        },
      ];
  
      const result = await userModel.aggregate(pipeline);
      const profitLossData = result[0]?.paginatedResults || [];
      const totalRecords = result[0]?.totalRecords[0]?.total || 0;
  
      return {
        statusCode: 200,
        success: true,
        message: 'Profit/Loss data fetched successfully.',
        data: profitLossData,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalRecords / limitNumber),
          totalRecords,
        },
      };
    } catch (error) {
      console.error('Error in getSportProfitLossReport:', error);
      return {
        statusCode: 500,
        success: false,
        message: error.message || 'Server error occurred.',
      };
    }
  };
  

  exports.callBack = async (req) => {
    const data = req.body;
    if (!data) {
      return {
        success: false,
        message: 'No data provided.',
        data: {}
      };
    }
  
    try {
     
      let logData = data;
      if (typeof data !== 'object') {
        try {
          logData = JSON.parse(data); 
        } catch (error) {
          logger.error(LOG_ID, `Error parsing JSON data: ${error.message || error}`);
          return {
            success: false,
            message: 'Invalid JSON format in data.',
            data: {}
          };
        }
      }
  
      await casinoLogsModel.create({ data: JSON.stringify(logData) });
      return {
        success: true,
        message: 'Data saved successfully.',
        data: logData
      };
    } catch (error) {
      logger.error(LOG_ID, `Error occurred during save callback: ${error.message || error}`);
      return {
        success: false,
        message: 'Something went wrong while saving data.',
        data: {}
      };
    }
  };

  
  
exports.getUserViaID = async (req) => {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return {
        success: false,
        message: 'User not found.',
        data: []
      };
    }
    return {
      success: true,
      message: 'User fetched successfully.',
      data: user
    };
  } catch (error) {
    logger.error(LOG_ID, `Error occurred during fetching user: ${error.message || error}`);
    return {
      success: false,
      message: 'Something went wrong.',
      data: []
    };
  }
};
exports.withdrawalTransactionDetails = async (userId, reqQuery) => {
    try {
        let { page = 1, perPage = 10, transactionId, chain } = reqQuery;
        page = Number(page);
        perPage = Number(perPage);

        const filter = {
            userid: mongoose.Types.ObjectId(userId),
            ...(transactionId && { transaction_id: transactionId }),
            ...(chain && { chain })
        };

        const pipeline = [
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'transactions',
                    localField: 'transaction_id',
                    foreignField: 'transaction_id',
                    as: 'transaction'
                }
            },
            {
                $unwind: {
                    path: '$transaction',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    image: { $concat: [constants.BASE_URL_Without_Slas, '$image'] }
                }
            },
            {
                $facet: {
                    pagination: [
                        {
                            $group: {
                                _id: null,
                                totalChildrenCount: { $sum: 1 }
                            }
                        },
                        {
                            $addFields: {
                                page,
                                perPage
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                totalChildrenCount: 1,
                                totalPages: {
                                    $ceil: {
                                        $divide: ['$totalChildrenCount', perPage]
                                    }
                                },
                                page,
                                perPage
                            }
                        }
                    ],
                    fetchDetails: [
                        { $skip: (page - 1) * perPage },
                        { $limit: perPage }
                    ]
                }
            },
            {
                $unwind: '$pagination'
            },
            {
                $project: {
                    pagination: 1,
                    fetchDetails: 1
                }
            }
        ];


        const data = await query.aggregation(withdrawModel, pipeline);
        if (data.length > 0 && data[0].fetchDetails.length > 0) {
            return {
                success: true,
                message: 'Retrieved withdrawal transaction details successfully.',
                data: {
                    fetchDetails: data[0].fetchDetails,
                    pagination: data[0].pagination
                }
            };
        }

        return {
            success: false,
            message: 'Withdrawal transaction details not found.',
            data: []
        };
    } catch (error) {
        logger.error(LOG_ID, `Error occurred during fetching withdrawal transaction details: ${error.message || error}`);
        return {
            success: false,
            message: 'Something went wrong.',
            data: []
        };
    }
};

exports.submitWithdrawRequest = async (req, userId) => {
    try {
    
        let payload = req.body;
        const requiredFields = ['name', 'amount'];
        const validationFlag = validateWithdrawalRequest(payload, requiredFields);
        if (!validationFlag.isValid)
            return {
                success: false,
                message: validationFlag.error,
                data: {}
            };
        payload.userid = userId;
        const findUser = await userModel.findById(userId);

        if (findUser.openingBalance < payload.amount)
            return {
                success: false,
                message: 'Not Enough Balance',
                data: {}
            };
        let randomStr = randomstring.generate({
            length: 4,
            charset: 'alphabetic',
            capitalization: 'uppercase'
        });
        
        await transactionModel.create({
            userId,
            transferedBy: null,
            type: 'withdraw',
            amount: payload.amount,
            previousMainWallet:findUser.openingBalance,
            currentMainWallet:findUser.openingBalance-payload.amount,
            description: 'withdrawal request',
            transactionType: 'debit',
            transactionId: `${constants.APP_SHORT_NAME}-${Date.now()}-${randomStr}`
        });

        await userModel.updateOne({ _id: userId }, { $inc: { openingBalance: -payload.amount } });
        const withdrawal = await withdrawModel.create(payload);
        if (withdrawal) {
            return {
                success: true,
                message: 'Withdrawal request submitted successfully',
                data: {}
            };
        } else {
            return {
                success: false,
                message: 'Failed to submit withdrawal request',
                data: {}
            };
        }
    } catch (error) {
        console.log("ERROR",error);
        logger.error(LOG_ID, `Error occurred during processing withdrawal request: ${error}`);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};
exports.myOverAllProfitLossReport = async (userId, reqQuery) => {
    try {
        const agg = userDao.myOverAllProfitLossReportPipe(userId, reqQuery);
        const data = await query.aggregation(userBetModel, agg);

        if (data.length > 0 && data[0].fetchDetails.length > 0) {
            return {
                success: true,
                message: 'My Overall Profit and Loss data retrieved successfully.',
                data: data[0].fetchDetails,
                pagination: data[0].pagination
            };
        }

        return {
            success: false,
            message: 'No Overall Profit and Loss data found for the user.',
            data: []
        };
    } catch (error) {
        logger.error(LOG_ID, `Error occurred during fetching overall profit and loss report: ${error.message || error}`);
        return {
            success: false,
            message: 'Something went wrong.',
            data: []
        };
    }
};
exports.getCommissionReport = async (userId, reqQuery) => {
    try {
        const agg = userDao.commissionReportPipe(userId, reqQuery);
        const data = await query.aggregation(userModel, agg);

        if (data.length > 0 && data[0].fetchDetails.length > 0) {
            return {
                success: true,
                message: 'Commission report data retrieved successfully.',
                data: data[0].fetchDetails,
                pagination: data[0].pagination
            };
        }

        return {
            success: false,
            message: 'Commission report data not found.',
            data: []
        };
    } catch (error) {
        logger.error(
            LOG_ID,
            `Error occurred during fetching commission report: ${error.message || error}`
        );
        return {
            success: false,
            message: 'Something went wrong.',
            data: []
        };
    }
};

// exports.getUserOpenBets = async () => {
//     try {
//       const openBetsWithUsers = await userBetModel.aggregate([
//         { $match: { status: 'open', isDeleted:false } },
//         // { $group: { _id: '$userId' } },
//         // {
//         //   $lookup: {
//         //     from: 'users',
//         //     localField: '_id',
//         //     foreignField: '_id',
//         //     as: 'userDetails',
//         //   },
//         // },
//         // { $unwind: '$userDetails' },
//         // {
//         //   $project: {
//         //     _id: 0,
//         //     userId: '$_id',
//         //     username: '$userDetails.username',
//         //     name: '$userDetails.name',
//         //     email: '$userDetails.email',
//         //   },
//         // },
//       ]);
  
//       if (openBetsWithUsers.length === 0) {
//         return {
//           success: false,
//           message: 'No users with open status bets found',
//           data: [],
//         };
//       }
  
//       return {
//         success: true,
//         message: 'Users with open status bets fetched successfully',
//         data: openBetsWithUsers,
//       };
//     } catch (error) {
//         logger.error(
//             LOG_ID,
//             `Error occurred during fetching commission report: ${error.message || error}`
//         );
//         return {
//             success: false,
//             message: 'Something went wrong.',
//             data: []
//         };
//     }
//   };
  
  
  

exports.createBanner = async (req) => {
    try {
         
      const { title } = req.body;
  
      if (!title || !req.file || !req.file.path) {
        return {
          statusCode: 400,
          success: false,
          message: resMessage.Title_or_file_missing,
        };
      }
  
      // Create a new Picture document
      const picture = new pictureModel({
        title,
        imageUrl: req.file.path.replace(/\\/g, "/"), // Convert backslashes to forward slashes
      }); 
      // Save the picture to the database
      const savedPicture = await picture.save();
  
      // Return the response with the saved picture
      return {
        statusCode: 201,
        success: true,
        message: "Picture created successfully.",
        data: savedPicture,
      };
    } catch (error) {
       
      // Return error response
      return {
        statusCode: 500,
        success: false,
        message: "Unable to upload picture.",
      };
    }
  };
  
exports.getAllBanners = async (req) => {
    try {
     
      const pictures = await pictureModel.find();
      const baseUrl = process.env.HOST; 
      const normalizedPictures = pictures.map((picture) => {
        const normalizedImageUrl = `${baseUrl}/${picture.imageUrl}`;
        return {
          ...picture.toObject(),
          imageUrl: normalizedImageUrl, 
        };
      });
  

      return {
        statusCode: 200,
        success: true,
        message: "Pictures fetched successfully.",
        data: normalizedPictures,
      };
    } catch (error) {
      console.error("Error fetching pictures:", error);
  
      return {
        statusCode: 500,
        success: false,
        message: "unable to fetch pictures",
      };
    }
  };
  
  exports.getBannerById= async(req, res)=>
  {
  
    try{
      return  await pictureModel.findById(req.params.id);
    }
    catch(error)
    {
      return{
        statusCode: 500,
        success: false,
        message: "unable to fetch banner"
        } 
    }
  
  }
  exports.deleteBanner = async (req, res) => {
    try {
      // Find the picture by ID
      const picture = await pictureModel.findById(req.params.id);
      if (!picture) {
        return {
          statusCode: 404,
          success: false,
          message: "picture not found",
        };
      }
  
      try {
        const filePath = path.resolve(picture.imageUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); 
        }
      } catch (fileError) {
        return {
          statusCode: 500,
          success: false,
          message: "fail to delete picture",
        };
      }
  
      // Delete the document from the database
      await picture.deleteOne();
  
      // Send success response
      return {
        statusCode: 200,
        success: true,
        message: "picture deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting picture:", error);
  
      // Send error response
      return {
        statusCode: 500,
        success: false,
        message: "unable to delete picture",
      };
    }
  };
  exports.updatePicture = async (req, res) => {
    try {
     
      const id = req.params.id; // Get picture ID from request params
  
      // Find the existing picture by ID
      const existingPicture = await pictureModel.findById(id);
  
      if (!existingPicture) {
        return {
          success: false,
          message: "picture not found",
        };
      }
  
      // If a new file is uploaded, replace the old file
      if (req.file) {
        try {
          const oldFilePath = path.resolve(existingPicture.imageUrl); // Get absolute path of the old file
          const fileName = path.basename(oldFilePath); // Extract file name
          const newFilePath = path.join(path.dirname(oldFilePath), fileName); // Reuse the same file name and folder
  
          // Delete the old file if it exists
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath); // Delete the old file
          }
  
          // Rename the new file to match the old file name
          fs.renameSync(req.file.path, newFilePath);
  
          // Update the `imageUrl` with a relative path
          const relativePath = path.relative(path.resolve("./"), newFilePath).replace(/\\/g, "/"); // Normalize the path
          existingPicture.imageUrl = `/${relativePath}`; // Add leading slash for URL-style path
        } catch (error) {
          return {
            success: false,
            message: "fail to update picture",
          };
        }
      }
  
      // Update the picture record in the database
      const updatedPicture = await pictureModel.findByIdAndUpdate(
        id,
        { imageUrl: existingPicture.imageUrl }, // Only update the `imageUrl`
        { new: true } // Return the updated document
      );
  
      // Send a success response
      return {
        success: true,
        message: "image updated successfully",
        data: updatedPicture,
      };
    } catch (error) {
      // Send an error response
      return {
        success: false,
        message: "unable to update picture",
      };
    }
  };

exports.getUserOpenBets = async (req) => {
      try {
          const aggPipe=[];

          aggPipe.push({
              $match: {
                  userId: new mongoose.Types.ObjectId(req.auth._id),
                  status:"open",
                  isDeleted:false
              }
          });
  
         
              aggPipe.push(
              {
                $group:{
                    _id:"$matchId"
                }
              },
              {
                      $lookup: {
                          from: 'betmatches',
                          localField: '_id',
                          foreignField: '_id',
                          pipeline: [
                              {
                                  $project: {
                                      eventId: 1,
                                      match: 1,
                                      sport: 1
                                  }
                              }
                          ],
                          as: 'matchdetails'
                      }
               },
              {
                $unwind: {
                    path: '$matchdetails'
                  }
                },
                {
                    $project:{
                        "match": { $ifNull: ["$matchdetails.match",""]}
                    }
                }
            );
         

          const data = await userBetModel.aggregate(aggPipe);
          if (data.length > 0) return {
              success: true,
              message: 'Retrieved all my bets matches.',
              data: data || []
          };
  
          return {
              success: true,
              message: 'Open bets matches not found.',
              data: [],
              pagination: {}
          };
      } catch (error) {
          logger.error(LOG_ID, `Error occurred while retrieving bets: ${error}`);
          console.log(error);
          return {
              success: false,
              message: 'Something went wrong'
          };
      }
  };

  exports.getUserRollingCommission = async (req) => {
    try {
        let { page = 1, perPage = 10, startDate, endDate } = req.query;
        page = Number(page) || 1;
        perPage = Number(perPage) || 10;
        const skip = (page - 1) * perPage;

        let aggPipe = [];

        aggPipe.push({
            $match: {
                userId: new mongoose.Types.ObjectId(req.auth._id)
            }
        });

        if (startDate || endDate) {
            const s_Date = new Date(startDate);
            s_Date.setHours(0, 0, 0, 0);

            const e_Date = new Date(endDate);
            e_Date.setHours(23, 59, 59, 999);

            const Obj = {};
            if (startDate) {
                Obj["createdAt"] = { $gte: s_Date };
            }

            if (endDate) {
                Obj["createdAt"] = { $lte: e_Date };
            }

            aggPipe.push({
                $match: Obj
            });
        }

        aggPipe.push(
            {
                $lookup: {
                    from: 'userbets',
                    localField: 'betId',
                    foreignField: '_id',
                    pipeline: [
                        {
                            $project: {
                                amount: 1,
                                result: 1,
                                sport: 1
                            }
                        }
                    ],
                    as: 'userbets'
                }
            },
            {
                $unwind: {
                    path: '$userbets',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    commissionAmount: { $ifNull: ["$amount", 0] },
                    type: 1,
                    stakeAmount: { $ifNull: ["$userbets.amount", 0] }
                }
            }
        );

        aggPipe.push(
            {
                $facet: {
                    totalCount: [{ $count: "count" }],
                    data: [
                        { $skip: skip },
                        { $limit: perPage }
                    ]
                }
            }
        );

        const result = await commissionReportModel.aggregate(aggPipe);

        const totalCount = result[0]?.totalCount[0]?.count || 0;
        const data = result[0]?.data || [];

        if (data.length > 0) {
            return {
                success: true,
                message: 'Retrieved all User commission.',
                data,
                pagination: {
                    totalCount,
                    currentPage: page,
                    perPage,
                    totalPages: Math.ceil(totalCount / perPage)
                }
            };
        }

        return {
            success: true,
            message: 'User commission not found.',
            data: [],
            pagination: {}
        };
    } catch (error) {
        logger.error(LOG_ID, `Error occurred while retrieving User commission: ${error}`);
        console.log(error);
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
};


exports.getUserSportProfitLossReport = async ( req) => {
    const { page, limit, fromDate, toDate, search, userId }=req.query;
    try {
      
  
      let filter={
        _id : new mongoose.Types.ObjectId(req.auth._id)
      };
     
      if (search) {
        filter.sport = { $regex: search, $options: "i" };
      }
  
      let dateFilter = {};
      if (fromDate || toDate) {
        const start = fromDate ? moment(fromDate).startOf("day").toDate() : null;
        const end = toDate ? moment(toDate).endOf("day").toDate() : null;
  
        if (start)
          dateFilter.createdAt = { ...dateFilter.createdAt, $gte: start };
        if (end) dateFilter.createdAt = { ...dateFilter.createdAt, $lte: end };
      }
      

      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      const skip = (pageNumber - 1) * limitNumber;
  
  
      const pipeline = [
        { $match: filter },
  
        {
          $lookup: {
            from: "userbets",
            localField: "_id",
            foreignField: "userId",
            as: "userBets",
            pipeline: [
              { 
                $match:  {
                status: "closed",
                ...dateFilter
            }},
              // {
              //   $lookup: {
              //     from: "usercommissionreports",
              //     localField: "_id",
              //     foreignField: "betId",
              //     as: "commissionReport",
              //   },
              // },
              {
                $addFields: {
                  profitLoss: {
                    $cond: {
                      if: { $or: [
                        { $eq: ["$isDeleted", true] },
                        { $eq: ["$result", "CANCELLED"] }, 
                        { $eq: ["$result", "ABANDONED"] } 
                      ] },
                      then : 0, 
                      else: {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: ["$result", "WINNER"] },
                          then: "$actualWinningAmount",
                        },
                        {
                          case: { $eq: ["$result", "LOSER"] },
                          then: { $multiply: [-1, "$amount"] },
                        },
                      ],
                      default: "$amount",
                    },
                  }
                }
                  },
                  totalCommission: {
                    $sum: "$commission",
                  },
                },
              },
              {
                $lookup: {
                  from: "betmatches",
                  localField: "matchId",
                  foreignField: "_id",
                  as: "betMatch",
                },
              },
              {
                $unwind: { path: "$betMatch", preserveNullAndEmptyArrays: true },
              },
              {
                $project: {
                  sport: {$ifNull: ["$betMatch.sport", "Casino"]},
                  profitLoss: 1,
                  gameId: {$ifNull: ["$betMatch.gameId", "$sportsId"]},
                  totalCommission: 1,
                },
              },
            ],
          },
        },
  
        { $unwind: { path: "$userBets", preserveNullAndEmptyArrays: true } },
  
        {
          $addFields: {
            sport: "$userBets.sport",
            gameId: "$userBets.gameId",
            uplineProfitLoss: {
              $multiply: [{ $ifNull: ["$userBets.profitLoss", 0] }, -1],
            },
            downlineProfitLoss: { $ifNull: ["$userBets.profitLoss", 0] },
            totalCommission: {
              $ifNull: ["$userBets.totalCommission", 0],
            },
          },
        },
  
        { $match: { sport: { $ne: null } } },
  
        {
          $group: {
            _id: "$sport",
            gameId: { $first: "$gameId" },
            totalUplineProfitLoss: { $sum: "$uplineProfitLoss" },
            totalDownlineProfitLoss: { $sum: "$downlineProfitLoss" },
            totalCommission: { $sum: "$totalCommission" },
          },
        },
  
        { $sort: { _id: 1 } },
  
        {
          $facet: {
            paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
            totalRecords: [{ $count: "total" }],
          },
        },
      ];
  
      const result = await userModel.aggregate(pipeline);
      const profitLossData = result[0]?.paginatedResults || [];
      let totalDownlineProfit = profitLossData.reduce(
        (acc, item) => acc + item.totalDownlineProfitLoss,
        0
      );
      let totalCommission = profitLossData.reduce(
        (acc, item) => acc + item.totalCommission,
        0
      );
  
      const totalRecords = result[0]?.totalRecords[0]?.total || 0;
  
      return {
        statusCode: 200,
        success: true,
        message: "Profit/Loss data fetched successfully.",
        data: profitLossData,
        totalDownlineProfit,
        totalUplineProfitLoss: totalDownlineProfit * -1,
        totalCommission,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalRecords / limitNumber),
          totalRecords: totalRecords,
        },
      };
    } catch (error) {
      console.error("Error in getSportProfitLossReport:", error);
      return {
        statusCode: 500,
        success: false,
        message: error.message || "Server error occurred.",
      };
    }
  };
  
  exports.getUserSportEventProfitLossReport = async (req ) => {
   const  { page, limit, fromDate, toDate, search, gameId, userId } = req.query;
    try {
      const loggedInUser = req.auth;
  
      let filter = { 
        gameId: gameId
       };
      if (search) {
        filter.sport = { $regex: search, $options: "i" };
      }
  
      let dateFilter = {};
      if (fromDate || toDate) {
        const start = fromDate ? moment(fromDate).startOf("day").toDate() : null;
        const end = toDate ? moment(toDate).endOf("day").toDate() : null;
        if (start) dateFilter.createdAt = { ...dateFilter.createdAt, $gte: start };
        if (end) dateFilter.createdAt = { ...dateFilter.createdAt, $lte: end };
      }

  
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      const skip = (pageNumber - 1) * limitNumber;
      
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "userbets",
            localField: "_id",
            foreignField: "matchId",
            as: "userBets",
            pipeline: [
              { $match: { 
                ...dateFilter,
                status: "closed",
                userId: new mongoose.Types.ObjectId(loggedInUser._id)            
              } 
             },
              // {
              //   $lookup: {
              //     from: "usercommissionreports",
              //     localField: "_id",
              //     foreignField: "betId",
              //     as: "commissionReport",
              //   },
              // },
              {
                $addFields: {
                  profitLoss: {
                    $cond: {
                      if: { $or: [
                        { $eq: ["$isDeleted", true] },
                        { $eq: ["$result", "CANCELLED"] }, 
                        { $eq: ["$result", "ABANDONED"] } 
                      ] },
                      then : 0, 
                      else: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$result", "WINNER"] }, then: "$actualWinningAmount" },
                        { case: { $eq: ["$result", "LOSER"] }, then: { $multiply: [-1, "$amount"] } },
                      ],
                      default: "$amount",
                    },
                  }
                }
                  },
                  totalCommission: { $sum: "$commission" },
                },
              },
            ],
          },
        },
        {
          $addFields:{
            betCount:{ $size: "$userBets"}
          }
        },
        {
          $match:{ betCount:{ $gt:0}}
        },
        { $unwind: { path: "$userBets", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            sport: "$sport",
            uplineProfitLoss: { $multiply: [{ $ifNull: ["$userBets.profitLoss", 0] }, -1] },
            downlineProfitLoss: { $ifNull: ["$userBets.profitLoss", 0] },
            totalCommission: { $ifNull: ["$userBets.totalCommission", 0] },
          },
        },
        {
          $group: {
            _id: "$_id",
            sport: { $first: "$sport" },
            betCount:{ $first:"$betCount"},
            totalUplineProfitLoss: { $sum: "$uplineProfitLoss" },
            totalDownlineProfitLoss: { $sum: "$downlineProfitLoss" },
            totalCommission: { $sum: "$totalCommission" },
            createdAt: { $first: "$createdAt" },
            match: { $first: "$match" }
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
            totalRecords: [{ $count: "total" }],
          },
        },
      ];
  
      const result = await betMatchModel.aggregate(pipeline);
      const profitLossData = result[0]?.paginatedResults || [];
      const totalRecords = result[0]?.totalRecords[0]?.total || 0;
  
      return {
        statusCode: 200,
        success: true,
        message: "Profit/Loss data fetched successfully.",
        data: profitLossData,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalRecords / limitNumber),
          totalRecords: totalRecords,
        },
      };
    } catch (error) {
      console.error("Error in getSportEventProfitLossReport:", error);
      return {
        statusCode: 500,
        success: false,
        message: error.message || "Server error occurred.",
      };
    }
  };

  exports.getUserCasinoGamesProfitLossReport = async (req ) => {
    const  { page, limit, fromDate, toDate, search, userId } = req.query;
     try {
       const loggedInUser = req.auth;
       let dateFilter = {};
       if (fromDate || toDate) {
         const start = fromDate ? moment(fromDate).startOf("day").toDate() : null;
         const end = toDate ? moment(toDate).endOf("day").toDate() : null;
         if (start) dateFilter.createdAt = { ...dateFilter.createdAt, $gte: start };
         if (end) dateFilter.createdAt = { ...dateFilter.createdAt, $lte: end };
       }

       const filter = {
        // userId: new mongoose.Types.ObjectId(loggedInUser._id),
        type: "casino",
        ...dateFilter,
        status: "closed"
       }

       if (search) {
        filter.sport = { $regex: search, $options: "i" };
       }
 
   
       const pageNumber = Number(page) || 1;
       const limitNumber = Number(limit) || 10;
       const skip = (pageNumber - 1) * limitNumber;
       
       const pipeline = [
         { $match: filter },
         {
          $lookup: {
              from: 'casinoprovidergames',
              localField: 'game_id',
              foreignField: 'gameId',
              pipeline: [],
              as: 'GameDetails'
          }
         },
         {
          $unwind: {
            path: '$GameDetails',
            preserveNullAndEmptyArrays: true
          }
         },
         {
          $addFields: {
            profitLoss: {
              $cond: {
                if: { $or: [
                  { $eq: ["$isDeleted", true] },
                  { $eq: ["$result", "CANCELLED"] }, 
                  { $eq: ["$result", "ABANDONED"] } 
                ] },
                then : 0, 
                else: {
              $switch: {
                branches: [
                  { case: { $eq: ["$result", "WINNER"] }, then: "$actualWinningAmount" },
                  { case: { $eq: ["$result", "LOSER"] }, then: { $multiply: [-1, "$amount"] } },
                ],
                default: "$amount",
              },
            }
           }
            },
            totalCommission: { $sum: "$commission" },
          },
        },
        {
          $addFields: {
            sport: "Casino",
            uplineProfitLoss: { $multiply: [{ $ifNull: ["$profitLoss", 0] }, -1] },
            downlineProfitLoss: { $ifNull: ["$profitLoss", 0] },
            totalCommission: { $ifNull: ["$totalCommission", 0] },
          },
        },
         {
           $group: {
             _id: "$game_id",
             sport: { $first: "$sport" },
             totalUplineProfitLoss: { $sum: "$uplineProfitLoss" },
             totalDownlineProfitLoss: { $sum: "$downlineProfitLoss" },
             totalCommission: { $sum: "$totalCommission" },
             gameName: { $first: "$GameDetails.name" },
             provider: { $first: "$GameDetails.provider" },
             game_id: { $first: "$game_id" }
           },
         },
         { $sort: { createdAt: -1 } },
         {
           $facet: {
             paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
             totalRecords: [{ $count: "total" }],
           },
         },
       ];
   
       const result = await userBetModel.aggregate(pipeline);
       console.log(result)
       const profitLossData = result[0]?.paginatedResults || [];
       const totalRecords = result[0]?.totalRecords[0]?.total || 0;
   
       return {
         statusCode: 200,
         success: true,
         message: "Profit/Loss data fetched successfully.",
         data: profitLossData,
         pagination: {
           currentPage: pageNumber,
           totalPages: Math.ceil(totalRecords / limitNumber),
           totalRecords: totalRecords,
         },
       };
     } catch (error) {
       console.error("Error in getSportEventProfitLossReport:", error);
       return {
         statusCode: 500,
         success: false,
         message: error.message || "Server error occurred.",
       };
     }
   };

  exports.getUserMatchBetProfitLossReport = async (  req ) => {
    const { page, limit, fromDate, toDate, search, matchId, userId } = req.query;
    try {
  
      let filter = {
        status: "closed",
        matchId: new mongoose.Types.ObjectId(matchId),
        userId: new mongoose.Types.ObjectId(req.auth._id),
      };
  
      if (search) {
        filter.sport = { $regex: search, $options: "i" };
      }
  
      if (fromDate || toDate) {
        const start = fromDate ? moment(fromDate).startOf("day").toDate() : null;
        const end = toDate ? moment(toDate).endOf("day").toDate() : null;
  
        if (start) filter.createdAt = { ...filter.createdAt, $gte: start };
        if (end) filter.createdAt = { ...filter.createdAt, $lte: end };
      }
  
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      const skip = (pageNumber - 1) * limitNumber;
  
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "usercommissionreports",
            localField: "_id",
            foreignField: "betId",
            as: "commissionReport",
          },
        },
        {
          $lookup: {
            from: "betmatches",
            localField: "matchId",
            foreignField: "_id",
            as: "matchDetails",
          },
        },
        { $unwind: { path: "$matchDetails", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            sport: "$matchDetails.sport",
            match: "$matchDetails.match",
            totalCommission:{$sum: "$commissionReport.amount"}
          },
        },
        {
          $addFields: {
            profitLoss: {
              $cond: {
                if: { $or: [
                  { $eq: ["$isDeleted", true] },
                  { $eq: ["$result", "CANCELLED"] } 
                ] },
                then : 0, 
                else: {
              $cond: {
                if: { $eq: ["$result", "WINNER"] },
                then: "$actualWinningAmount",
                else: {
                  $cond: {
                    if: { $eq: ["$result", "LOSER"] },
                    then: { $multiply: [-1, "$amount"] },
                    else: "$amount",
                  },
                },
              },
            }
          }
            },
          },
        },
        {
          $addFields: {
            uplineProfitLoss: {
              $multiply: [{ $ifNull: ["$profitLoss", 0] }, -1],
            },
            downlineProfitLoss: { $ifNull: ["$profitLoss", 0] },
            totalCommission: { $ifNull: ["$totalCommission", 0] },
          },
        },
        {
          $group: {
            _id: "$matchId",
            match: { $first: "$match" },
            sport: { $first: "$sport" },
            result : { $first: "$result" },
            totalUplineProfitLoss: { $sum: "$uplineProfitLoss" },
            totalDownlineProfitLoss: { $sum: "$downlineProfitLoss" },
            totalCommission: { $sum: "$totalCommission" },
            createdAt: { $first: "$createdAt" },
            matchDetails: { $first: "$matchDetails" },
            marketName:  { $first: "$marketName" },
            result:  { $first: "$result" },
            selectionId: { $first: "$selectionId" },
            type:{ $first: "$type" }
          },
        },
        {
          $facet: {
            paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
            totalRecords: [{ $count: "total" }],
          },
        },
      ];
  
      const result = await userBetModel.aggregate(pipeline);
      const paginatedResults = result[0]?.paginatedResults || [];
      const totalRecords = result[0]?.totalRecords[0]?.total || 0;
  
      return {
        statusCode: 200,
        success: true,
        message: "Profit/Loss data fetched successfully.",
        data: paginatedResults,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalRecords / limitNumber),
          totalRecords,
        },
      };
    } catch (error) {
      console.error("Error in getMatchBetProfitLossReport:", error);
      return {
        statusCode: 500,
        success: false,
        message: error.message || "Server error occurred.",
      };
    }
  };


  exports.getUserSelectionBetProfitLossReport = async (req ) => {
    const { page, limit, fromDate, toDate, search, selectionId, matchId,type }=req.query;
    try {
      const loggedInUser = req.auth;
      
      let filter = {
        status: "closed",
        matchId: new mongoose.Types.ObjectId(matchId),
        userId: new mongoose.Types.ObjectId(loggedInUser._id), 
      };

      if(selectionId){
        filter.selectionId= selectionId
      }
      if(type){
        filter.type= type
      }
  
      if (search) {
        filter.sport = { $regex: search, $options: "i" };
      }
  
      if (fromDate || toDate) {
        const start = fromDate ? moment(fromDate).startOf("day").toDate() : null;
        const end = toDate ? moment(toDate).endOf("day").toDate() : null;
  
        if (start) filter.createdAt = { ...filter.createdAt, $gte: start };
        if (end) filter.createdAt = { ...filter.createdAt, $lte: end };
      }
  
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      const skip = (pageNumber - 1) * limitNumber;
  
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "usercommissionreports",
            localField: "_id",
            foreignField: "betId",
            as: "commissionReport",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "User",
          },
        },
        { $unwind: { path: "$User", preserveNullAndEmptyArrays: true } },
        {
          $addFields:{ username: { $ifNull:[ "$User.username",""]}}
        },
        {
          $lookup: {
            from: "betmatches",
            localField: "matchId",
            foreignField: "_id",
            pipeline: [
              // { $unwind: { path: "$market", preserveNullAndEmptyArrays: true } },
              // { $match: { "market.status": "WINNER" } },
              {
                $project: {
                  // status: "$market.status",
                  // marketName: "MATCH_ODDS",
                  sport: 1,
                  match: 1,
                },
              },
            ],
            as: "matchDetails",
          },
        },
        { $unwind: { path: "$matchDetails", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            sport: "$matchDetails.sport",
            match: "$matchDetails.match",
            totalCommission:{ $sum: "$commissionReport.amount" },
            marketNameTwo:"$marketName"
          },
        },
        {
          $addFields: {
            profitLoss: {
              $cond: {
                if: { $or: [
                  { $eq: ["$isDeleted", true] },
                  { $eq: ["$result", "CANCELLED"] },
                  { $eq: ["$result", "ABANDONED"] } 
                ] },
                then : 0, 
                else: {
              $cond: {
                if: { $eq: ["$result", "WINNER"] },
                then: "$actualWinningAmount",
                else: {
                  $cond: {
                    if: { $eq: ["$result", "LOSER"] },
                    then: { $multiply: [-1, "$amount"] },
                    else: "$amount",
                  },
                },
              },
            },
          },
        }
      }
     },
        {
            $group: {
              _id: {
                groupByField: {
                  $cond: { if: { $eq: ["$type", "fancy"] }, then: "$marketNameTwo", else: "$type" },
                },
              },
              totalProfitLoss: { $sum: "$profitLoss" },
              totalCommission: { $sum: "$totalCommission" },
              totalPotentialWin: { $sum: "$potentialWin" },
              totalAmount: { $sum: "$amount" },
              username: { $first: "$username" },
              sport: { $first: "$sport" },
              match: { $first: "$match" },
              result: { $first: "$result" },
              selectionId: { $first: "$selectionId" },
              marketStartTime: { $first: "$marketStartTime" },
              matchDetails: { $first: "$matchDetails" },
              settledTime: { $first: "$settledTime" },
              marketName: { $first: "$oddsWinner" },
              type: { $first: "$type" },
              betType: { $first: "$betType" },
              matchId: { $first: "$matchId" },
              marketNameTwo: { $first: "$marketName" }, 
            },
          },
        {
          $facet: {
            paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
            totalRecords: [{ $count: "total" }],
          },
        },
      ];

  
      const result = await userBetModel.aggregate(pipeline);
  
      const paginatedResults = result[0]?.paginatedResults || [];
      const totalRecords = result[0]?.totalRecords[0]?.total || 0;
  
      return {
        statusCode: 200,
        success: true,
        message: "Profit/Loss data fetched successfully.",
        data: paginatedResults,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalRecords / limitNumber),
          totalRecords,
        },
      };
    } catch (error) {
      console.error("Error in getSelectionBetProfitLossReport:", error);
      return {
        statusCode: 500,
        success: false,
        message: error.message || "Server error occurred.",
      };
    }
  };

  exports.getFancyBets = async (req) => {
    try {
  
        let {  matchId , selectionId } = req.query;
        const userId=req.auth._id;
  
        let aggPipe = [];
        aggPipe.push({
            $match: {
              matchId: new mongoose.Types.ObjectId(matchId),
                isDeleted:false,
                type: "fancy",
                selectionId,
                userId: new mongoose.Types.ObjectId(userId)
            }
        });
  
       
        aggPipe.push(
            {
                $lookup: {
                    from: 'betmatches',
                    localField: 'matchId',
                    foreignField: '_id',
                    pipeline: [
                        {
                            $project: {
                                eventId: 1,
                                bookMakerStatus: 1,
                                match: 1,
                                stopBet: 1,
                                status: 1,
                                scoreUrl: 1,
                                oddsStatus: 1,
                                inPlay: 1,
                                sport: 1,
                                marketStartTime:1,
                                sportsId:1
                            }
                        }
                    ],
                    as: 'matchdetails'
                }
            },
            {
                $unwind: {
                    path: '$matchdetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: {
                    'createdAt': -1
                }
            },
            {
                $addFields:{ 
                    sportsId: { $ifNull: ["$matchdetails.sportsId", 1]}
                }
            }
        );
  
        
  
        const data = await userBetModel.aggregate(aggPipe);
        if (data.length > 0) return {
            success: true,
            message: 'Retrieved all my bets successfully.',
            data: data || []
        };
  
        return {
            success: true,
            message: 'Bets not found.',
            data: [],
            pagination: {}
        };
    } catch (error) {
      console.log(error)
        return {
            success: false,
            message: 'Something went wrong'
        };
    }
  };
exports.updateUserProfile = async ({ userId, betBidValue, color }) => {
    try {
        if (!userId) {
            return { success: false, message: 'User ID is required' };
        }

        const user = await userModel.findOne({ _id: userId, isDeleted: false });
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            userId,
            { 
                betBidValue: betBidValue !== undefined ? betBidValue : user.betBidValue, 
                color: color !== undefined ? color : user.color 
            },
            { new: true } 
        );

        return {
            success: true,
            message: 'User profile updated successfully',
            data: updatedUser
        };
    } catch (error) {
        console.error('Error updating user profile:', error);
        return { success: false, message: 'Something went wrong', error };
    }
};

exports.getUserSportEventProfitLossReports = async ( req
) => {
  try {
   let  { page, limit, fromDate, toDate, search, gameId, type } = req.query;
    const userId = req.auth._id; // Get user ID from auth
    if (!userId) {
      return {
        statusCode: 400,
        success: false,
        message: "User ID is required.",
      };
    }
    let filter = { };

    if (gameId && gameId !== "0") {
      filter.gameId = gameId;
    }

    if (search) {
      filter.sport = { $regex: search, $options: "i" };
    }

    let dateFilter = {};
    if (fromDate || toDate) {
      const start = fromDate ? moment(fromDate).startOf("day").toDate() : null;
      const end = toDate ? moment(toDate).endOf("day").toDate() : null;
      if (start) dateFilter.createdAt = { ...dateFilter.createdAt, $gte: start };
      if (end) dateFilter.createdAt = { ...dateFilter.createdAt, $lte: end };
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    const lookupPipeline = [
      { $match: { ...dateFilter, status: "closed", userId: new mongoose.Types.ObjectId(userId) } }
    ];

    if (type && type !== "ALL") {
      lookupPipeline.push({ $match: { type } });
    }

    lookupPipeline.push(
      {
        $lookup: {
          from: "usercommissionreports",
          localField: "_id",
          foreignField: "betId",
          as: "commissionReport",
        },
      },
      {
        $addFields: {
          profitLoss: {
            $cond: {
              if: {
                $or: [
                  { $eq: ["$isDeleted", true] },
                  { $eq: ["$result", "CANCELLED"] },
                ],
              },
              then: 0,
              else: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$result", "WINNER"] }, then: "$actualWinningAmount" },
                    { case: { $eq: ["$result", "LOSER"] }, then: { $multiply: [-1, "$amount"] } },
                  ],
                  default: "$amount",
                },
              },
            },
          },
          totalCommission: { $sum: "$commissionReport.amount" },
        },
      }
    );

    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "userbets",
          localField: "_id",
          foreignField: "matchId",
          pipeline: lookupPipeline,
          as: "userBets",
        },
      },
      { $unwind: "$userBets" },
      {
        $addFields: {
          userId: "$userBets.userId",
          sport: "$sport",
          event: "$match",
          type: "$userBets.type",
          oddsWinner: "$userBets.oddsWinner",
          marketName: "$userBets.marketName",
          fancyOdds: "$userBets.fancyOdds",
          selectionId: "$userBets.selectionId",
          matchTime: "$userBets.matchTime",
          isDeleted: "$userBets.isDeleted",
          placeTime: "$userBets.placeTime",
          settledTime: "$userBets.settledTime",
          username: "$userBets.username",
          potentialWin: "$userBets.potentialWin",
          betType: "$userBets.betType",
          uplineProfitLoss: { $multiply: [{ $ifNull: ["$userBets.profitLoss", 0] }, -1] },
          downlineProfitLoss: { $ifNull: ["$userBets.profitLoss", 0] },
          totalCommission: { $ifNull: ["$userBets.totalCommission", 0] },
        },
      },
      {
        $group: {
          _id: "$selectionId",
          totalUplineProfitLoss: { $sum: "$uplineProfitLoss" },
          totalDownlineProfitLoss: { $sum: "$downlineProfitLoss" },
          totalCommission: { $sum: "$totalCommission" },
          countBets: { $sum: 1 },
          marketName: { $first: "$marketName" },
          oddsWinner: { $first: "$oddsWinner" },
          matchTime: { $first: "$matchTime" },
          placeTime: { $first: "$placeTime" },
          settledTime: { $first: "$settledTime" },
          username: { $first: "$username" },
          potentialWin: { $first: "$potentialWin" },
          betType: { $first: "$betType" },
          type: { $first: "$type" },
          sport: { $first: "$sport" },
          event: { $first: "$event" },
          fancyOdds: { $first: "$fancyOdds" },
        },
      },
      { $sort: { matchTime: -1 } },
      {
        $facet: {
          paginatedResults: [{ $skip: skip }, { $limit: limitNumber }],
          totalRecords: [{ $count: "total" }],
        },
      },
    ];

    const result = await betMatchModel.aggregate(pipeline);
    const profitLossData = result[0]?.paginatedResults || [];
    const totalRecords = result[0]?.totalRecords[0]?.total || 0;

    return {
      statusCode: 200,
      success: true,
      message: "User-specific Profit/Loss data fetched successfully.",
      data: profitLossData,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalRecords / limitNumber),
        totalRecords: totalRecords,
      },
    };
  } catch (error) {
    console.error("Error in getUserSportEventProfitLossReport:", error);
    return {
      statusCode: 500,
      success: false,
      message: error.message || "Server error occurred.",
    };
  }
};


exports.getUserBetList = async (req) => {
  try {
    const userId = req.auth?._id;
    if (!userId) {
      return {
        statusCode: 400,
        success: false,
        message: "User not authenticated.",
      };
    }

    const {
      page = 1,
      limit = 10,
      sport,
      fromDate,
      toDate,
      betstatus,
      search,
      type,
      selectionId,
      betType,
      isDeleted,
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    let filter = { status: "closed", userId: new mongoose.Types.ObjectId(userId) };

    if (betstatus && betstatus !== "ALL") filter.betstatus = betstatus;
    if (type && type !== "ALL") filter.type = type;

    if (betType && betType !== "ALL") {
      filter["$or"] =
        betType === "back"
          ? [{ betType: "back" }, { betType: "yes" }]
          : betType === "lay"
          ? [{ betType: "lay" }, { betType: "no" }]
          : [{ betType }];
    }

    const agp = [{ $match: filter }];

    agp.push(
      {
        $lookup: {
          from: "betmatches",
          localField: "matchId",
          foreignField: "_id",
          pipeline: [{ $project: { match: 1, sport: 1, marketStartTime: 1, marketType: 1 } }],
          as: "matchDetails",
        },
      },
      { $unwind: { path: "$matchDetails", preserveNullAndEmptyArrays: true } }
    );

    if (sport && sport !== "ALL") agp.push({ $match: { "matchDetails.sport": sport } });

    if (selectionId) {
      let selectionFilter = { selectionId };
      if (typeof isDeleted !== "undefined") selectionFilter.isDeleted = !!isDeleted;
      agp.push({ $match: selectionFilter });
    }

    if (search) {
      agp.push({
        $match: {
          $or: [
            { "matchDetails.match": { $regex: search, $options: "i" } },
            { type: { $regex: search, $options: "i" } },
            { betstatus: { $regex: search, $options: "i" } },
            { "matchDetails.sport": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    if (fromDate || toDate) {
      let dateFilter = {};
      if (fromDate) dateFilter.$gte = moment(fromDate).startOf("day").toDate();
      if (toDate) dateFilter.$lte = moment(toDate).endOf("day").toDate();
      agp.push({ $match: { createdAt: dateFilter } });
    }

    agp.push(
      {
        $project: {
          sport: "$matchDetails.sport",
          event: "$matchDetails.match",
          market: "$marketName",
          selection: "$marketName",
          betstatus: 1,
          isDeleted: 1,
          oddsRequested: "$odds",
          fancyOdds: 1,
          selectionId: 1,
          stake: "$amount",
          potentialWin: 1,
          actualWinningAmount: 1,
          profitLoss: { $subtract: ["$potentialWin", "$amount"] },
          result: "$status",
          placeTime: 1,
          matchTime: 1,
          settleTime: "$updatedAt",
          createdAt: 1,
          oddsWinner: 1,
          odds: 1,
          type: 1,
          betType: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNumber }
    );

    const bets = await userBetModel.aggregate(agp);

    const totalBets = await userBetModel.countDocuments(filter);
    const totalPages = Math.ceil(totalBets / limitNumber);

    return {
      statusCode: 200,
      success: true,
      message: "User Bet List fetched successfully.",
      data: bets,
      pagination: {
        currentPage: pageNumber,
        totalPages: totalPages || 1,
        totalBets,
      },
    };
  } catch (error) {
    console.error("Error in getUserBetList:", error);
    return {
      statusCode: 500,
      success: false,
      message: error.message || "Internal server error.",
    };
  }
};

exports.getCurrentBetList = async (req) => {
  try {
    const userId = req.auth?._id; 
    if (!userId) {
      return {
        statusCode: 400,
        success: false,
        message: "User not authenticated.",
      };
    }

    const {
      page = 1,
      limit = 10,
      sport,
      betType,
      matchId,
      type,
      fromDate,
      toDate,
      fromTime,
      toTime,
    } = req.query; 

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    let matchFilter = { userId: new mongoose.Types.ObjectId(userId), status: "open" };

    if (matchId) matchFilter.matchId = new mongoose.Types.ObjectId(matchId);
    
    if (betType && betType !== "ALL") {
      matchFilter["$or"] =
        betType === "back"
          ? [{ betType: "back" }, { betType: "yes" }]
          : betType === "lay"
          ? [{ betType: "lay" }, { betType: "no" }]
          : [{ betType }];
    }
    
    if (type) matchFilter.type = type;

    if (fromDate || toDate) {
      let start, end;

      if (fromDate && fromTime) {
        start = moment(`${fromDate} ${fromTime}`, "YYYY-MM-DD HH:mm").toDate();
      } else if (fromDate) {
        start = moment(fromDate).startOf("day").toDate();
      }

      if (toDate && toTime) {
        end = moment(`${toDate} ${toTime}`, "YYYY-MM-DD HH:mm").toDate();
      } else if (toDate) {
        end = moment(toDate).endOf("day").toDate();
      }

      if (start) matchFilter.createdAt = { ...matchFilter.createdAt, $gte: start };
      if (end) matchFilter.createdAt = { ...matchFilter.createdAt, $lte: end };
    }

    const unsettledBets = await userBetModel.aggregate([
      { $match: matchFilter },
      {
        $lookup: {
          from: "betmatches",
          localField: "matchId",
          foreignField: "_id",
          as: "matchDetails",
        },
      },
      { $unwind: { path: "$matchDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: 1,
          matchId: 1,
          selectionId: 1,
          type: 1,
          sport: "$matchDetails.sport",
          event: "$matchDetails.match",
          marketType: "$matchDetails.marketType",
          marketName: 1,
          status: 1,
          betstatus: 1,
          stake: 1,
          amount: 1,
          odds: 1,
          potentialWin: 1,
          createdAt: 1,
          actualWinningAmount: 1,
          placeTime: 1,
          settleTime: 1,
          result: 1,
          oddsWinner: 1,
          betType: 1,
          fancyOdds: 1,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNumber },
    ]);

    const totalBets = await userBetModel.countDocuments(matchFilter);

    return {
      statusCode: 200,
      success: true,
      message: "Current bets retrieved successfully.",
      data: unsettledBets,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalBets / limitNumber),
        totalBets,
      },
    };
  } catch (error) {
    console.error("Error fetching current bets:", error);
    return {
      statusCode: 500,
      success: false,
      message: error.message || "Internal server error",
    };
  }
};




  