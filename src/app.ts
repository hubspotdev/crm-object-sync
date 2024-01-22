import express, {Application, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authUrl, redeemCode } from "./auth";
import "dotenv/config";
import { PORT, getCustomerId } from "./utils";

const prisma = new PrismaClient()
const app: Application = express()


app.get('/toto', async (req: Request, res: Response) => {
    const prisma = new PrismaClient()
    const contacts = await prisma.contacts.findMany({})
        res.send(contacts)

    })


    app.get("/api/install", (req: Request, res: Response) => {
        res.send(authUrl);
      });
      
      app.get("/oauth-callback", async (req: Request, res: Response) => {
        const code = req.query.code;
      
        if (code) {
          try {
            const authInfo = await redeemCode(code.toString());
            const accessToken = authInfo.accessToken;
            res.redirect(`http://localhost:${PORT - 1}/`);
          } catch (error: any) {
            res.redirect(`/?errMessage=${error.message}`);
          }
        }
      });

app.listen(PORT, function () {
    console.log('App is listening on port ${port}')
})