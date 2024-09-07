import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import routes from './routes/index';
dotenv.config();



const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api", routes);

app.get("/health", async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: "server is healthy" });
});

const PORT = process.env.port || 3000;


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
