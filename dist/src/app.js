"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("./auth");
require("dotenv/config");
const utils_1 = require("./utils");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/contacts', async (req, res) => {
    const prisma = new client_1.PrismaClient();
    const contacts = await prisma.contacts.findMany({});
    res.send(contacts);
});
app.get('/api/install', (req, res) => {
    res.send(auth_1.authUrl);
});
app.get('/', async (req, res) => {
    const accessToken = await (0, auth_1.getAccessToken)((0, utils_1.getCustomerId)());
    res.send(accessToken);
});
app.get('/oauth-callback', async (req, res) => {
    const code = req.query.code;
    if (code) {
        try {
            const authInfo = await (0, auth_1.redeemCode)(code.toString());
            const accessToken = authInfo.accessToken;
            res.redirect(`http://localhost:${utils_1.PORT}/`);
        }
        catch (error) {
            res.redirect(`/?errMessage=${error.message}`);
        }
    }
});
app.listen(utils_1.PORT, function () {
    console.log('App is listening on port ${port}');
});
