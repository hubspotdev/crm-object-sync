import express, { Application, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authUrl, redeemCode } from './auth';
import 'dotenv/config';
import { PORT, getCustomerId } from './utils';

const prisma = new PrismaClient();
const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/contacts', async (req: Request, res: Response) => {
  const prisma = new PrismaClient();
  const contacts = await prisma.contacts.findMany({});
  res.send(contacts);
});

app.get('/api/install', (req: Request, res: Response) => {
  res.send(authUrl);
});

app.get('/oauth-callback', async (req: Request, res: Response) => {
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

// app.post("/addcontacts", async (req, res) => {
//   try{
//       const {id, email, first_name, last_name, hs_object_id} = req.body

//       const newContact = await prisma.contacts.create({
//           data: {
//               id,
//               email,
//               first_name,
//               last_name,
//               hs_object_id
//           }
//       })
//   res.json(newContact)
//    }
//     catch (error:any) {
//       console.log(error.message)
//       res.status(500).json({
//           message: "Internal Server Error",
//       })
//    }
// })

app.listen(PORT, function () {
  console.log('App is listening on port ${port}');
});
