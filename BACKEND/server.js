require("dotenv").config();

const express = require("express");
const cors = require("cors");

const avatarRoute = require("./routes/avatar");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Avatar Generator API Running");
});

app.use("/avatar", avatarRoute);

app.listen(5000, () => {
    console.log("Server running on port 5000");
});