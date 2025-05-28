import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";

//Load up and parse configuration details from the `.env` file to the `process.env` object of Node.js
dotenv.config();

// Create an Express application and get the value of the PORT environment variable from the `process.env`
const app: Express = express();
const port = process.env.PORT;
// Access information coming from forms
// app.use(express.urlencoded({ extended: true }));

// Do we need CORS?
const cors = require("cors");
app.use(cors());

const sharedVariable = "test";

app.get("/", (req: Request, res: Response) => {
  res.send("Danyal");
});

const lobbyRouter = require("./routes/lobby");
app.use("/lobby", lobbyRouter);

// Start the Express app and listen for incoming requests on the specified port
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
