require("dotenv").config();
const app = require("./src/app");
const connectToDb = require("./src/config/database");

// Connected to Database
connectToDb();

app.listen(7000, () => {
  console.log("Server is running on port 7000");
});
