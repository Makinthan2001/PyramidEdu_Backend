"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jwt_util_1 = require("../utils/jwt.util");
const AppError_1 = require("../utils/AppError");
function authenticate(req, _res, next) {
    var _a;
    try {
        const authHeader = req.headers.authorization;
        let token;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
        if (!token && ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken)) {
            token = req.cookies.accessToken;
        }
        if (!token) {
            throw new AppError_1.AppError('Authentication required. Please log in.', 401);
        }
        req.user = (0, jwt_util_1.verifyAccessToken)(token);
        next();
    }
    catch (error) {
        next(error);
    }
}
