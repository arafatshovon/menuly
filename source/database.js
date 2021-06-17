var mongoose = require('mongoose');
var Validator = require('validator');
var bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
var schema = mongoose.Schema;

//var dbUrl =  process.env.DB_URL; 
var dbUrl =  process.env.db_url; 
mongoose.connect(dbUrl, {useNewUrlParser:true, useUnifiedTopology:true, useCreateIndex:true, useFindAndModify:false})
.then(()=>console.log(`connection successful with ${dbUrl}`))
.catch((error)=>console.log(error));


var restaurant = new schema({
    userID:[
        {
            email:{
                type:String,
                //required:true,
                unique:true,
                validate(value){
                    if(!Validator.isEmail(value))
                        throw new Error("Invalid email.")
                }
            },

            password:{
                type:String,
                //require:true,
                minlength:8
            },

            designation:{
                type:String,
                default:"admin",
                //required:true
            },

            state:{
                type:String,
                default:"valid"
            }
        }
    ],

    restaurantName:{
        type:String,
        required:true
    },

    tokens:[
        {
            userToken:{
                type:String,
            }
        }
    ],

    foodDetails:[
        {
            foodName:{
                type:String
            },
            foodPrice:{
                type:Number
            },
            foodImage:{
                type:String
            },
            foodDescription:{
                type:String
            }
        }
    ],
    orderDetails:[],            //object
    kitchen:[],                 //object
    payment:[],                 //object
    orderHistory:[]            //object
});

// restaurant.pre("save", async function(){
//     if(this.isModified("password")){
//         console.log(this.password);
//         this.password = await bcrypt.hash(this.password,10);
//         console.log(this.password);
//     }
// })

restaurant.methods.generateAuthToken = async function(Email, post, time){
    try{
        payload = {
            ID:this._id,
            email:Email,
            designation:post
        }
        const token = await jwt.sign(payload, process.env.SECRET_KEY, {expiresIn:time});
        this.tokens = this.tokens.concat({userToken:token});
        await this.save();
        return token;
    }
    catch(e){
        console.log("hello world");
    }
}

var transporter = nodemailer.createTransport({
    service:"gmail",
    auth:{
        user:process.env.MAIL,
        pass:process.env.PASSWORD
    }
});

const Restaurant = new mongoose.model('restaurant', restaurant);
module.exports = {Restaurant, transporter};
