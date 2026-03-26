const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    userName:{
        type:String,
        required: [true, "Username is required"]
    },
    userEmail: {
        type:String,
        unique: [true,"Email Already Exists"],
        required: [true, "Email is required"]

    },
    password:{
        type:String,
        required: [true, "Password is required"]
    }
})

const userModel = mongoose.model("users",userSchema)

module.exports = userModel