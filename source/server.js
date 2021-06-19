require('dotenv').config();
const express = require('express');
const path = require('path');
const file = require("fs");
const http = require('http');
const hbs = require('hbs');
const ckparser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const upload = require('express-fileupload');
const csrf = require('csurf');
const csrfProtection = csrf({cookie:{httpOnly:true}});
const socketio = require('socket.io');
const {Restaurant, transporter} = require('./database');
const app = express();
const Server = http.createServer(app);
const io = socketio(Server);

const resSckt = {};
const customerSckt = [];
const port = process.env.PORT || 5000;

var viewPath = path.join(__dirname, '../template/views');
var foodimagePath = path.join(__dirname, '../uploads');

app.set("view engine", 'hbs');
app.set('views', viewPath);
app.use(express.static(foodimagePath));
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(ckparser());
app.use(upload());


async function givePermission(req, res, next){
    try{
        const token = req.cookies.jwt;
        let result = jwt.verify(token, process.env.SECRET_KEY);
        let user = await Restaurant.findOne({_id:result.ID});
        //console.log("payload:" ,result);
        req.User = user;
        req.Token = token;
        req.payload = result;
        next();
    }catch(e){ 
        res.redirect('/login');
    }
}

function checkForDuplicate(allrestaurant, Email){
    for(let index=0;index<allrestaurant.length;index++){
        for(value of allrestaurant[index].userID){
            if(value.email==Email)
                return false;
        }
    }
    return true;
}

//routes for customers
app.get("/", async (req, res)=>{
    let allrestaurant = await Restaurant.find();
    let list = [];
    for(index in allrestaurant){
        let obj = {
            _id:allrestaurant[index]._id,
            name:allrestaurant[index].restaurantName
        }
        if(allrestaurant[index].userID.length>0 && allrestaurant[index].userID[0].designation!='admin')
            list.push(obj);
    }
    res.status(200).render("restaurant",{rest: list});
})


app.get("/menu", async (req, res)=>{
    let id = req.query.id;
    let restaurant = await Restaurant.findOne({_id:id});
    let foodlist = restaurant.foodDetails;
    for(elem of foodlist){
        if(elem.foodImage){
            let imgname =  path.basename(elem.foodImage);
            elem.foodImage = imgname;
        }
    }
    //console.log(id);
    let key = Date.now() + Math.floor(Math.random()*100);
    //console.log(key);
    res.status(200).render("foodLayout", {item:foodlist, name:restaurant.restaurantName, ID:id, uniqueKey:key});
})

//routes for restaurants
app.get('/restaurantHome', csrfProtection, givePermission, async(req, res)=>{
    try{
        if(req.payload.designation=='owner'){
            let restaurant = await Restaurant.findOne({_id:req.payload.ID});
            let fooditems = restaurant.foodDetails;
            let allorder = restaurant.orderHistory;
            let activeUser = restaurant.userID;
            for(value of fooditems)
                value.foodImage = path.basename(value.foodImage);
            res.render('HomeRestaurant', {food: fooditems, order: allorder, user: activeUser, 
            ID: restaurant._id, Name: restaurant.restaurantName, csrf:req.csrfToken()});
        }else
            res.redirect('/*');
    }catch(e){
        res.send(e);
    }
})

app.get("/orderQueue", givePermission, (req, res)=>{
    let address = req.User._id;
    res.render('orderQueue', {ID:address, Name:req.User.restaurantName});
})

app.get("/kitchen", givePermission ,(req, res)=>{
    res.render('kitchenRoom', {ID:req.User._id, Name:req.User.restaurantName});
})

app.get('/payment', givePermission, (req, res)=>{
    res.render('payment',{ID:req.User._id, Name:req.User.restaurantName});
})

app.post('/ownerRequest', csrfProtection, givePermission, async (req, res)=>{
    try{
        if(req.payload.designation=='owner'){
            if(req.body.command=='deletion'){
                let imgpath;
                let restaurant = await Restaurant.findOne({_id:req.body.ID});
                restaurant.foodDetails = restaurant.foodDetails.filter((value)=>{
                    if(value._id!=req.body.foodID)
                        return value;
                    else
                        imgpath = value.foodImage;
                })
                await restaurant.save();
                file.unlink(imgpath, (err)=>{
                    if(err)
                        console.log(err);
                    else
                        console.log('successfully removed the image/png file from upload folder.');
                })
                res.json({result:'successful'});
            }
        }else
            res.json("you don't have permission to access the page.");
    }catch(e){
        res.send(e);
    }
})


// routes for admin
app.get('/admin', csrfProtection, givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let allrestaurant = await Restaurant.find();
            let list = [];
            for(index in allrestaurant){
                let obj = {
                    id:allrestaurant[index]._id,
                    name:allrestaurant[index].restaurantName
                }
                if(allrestaurant[index].userID.length>0 && (allrestaurant[index].userID[0].designation=='owner' || allrestaurant[index].userID[0].designation=='employee'))
                    list.push(obj);
                else if(allrestaurant[index].userID.length==0)
                    list.push(obj);
            }
            console.log(list);
            res.render('homeadmin', {rest:list, csrf:req.csrfToken()});
        }catch(e){
            res.send(e);
        }     
    }
    else
        res.redirect('/');
})


app.get("/createRestaurant", csrfProtection, givePermission,(req, res)=>{
    if(req.User.userID[0].designation=='admin')
        res.status(200).render("createRestaurant", {csrf:req.csrfToken()});
    else
        res.redirect('/*');
})

app.post("/createRestaurant", csrfProtection, givePermission, async(req, res)=>{
    try{
        let newRestaurant = new Restaurant({
            userID:[],
            restaurantName:req.body.resName,
        })
        await newRestaurant.save();
        console.log("user saved");
        res.redirect("/admin");
        //res.send("user saved");
    }catch(e){
        res.send(e);
    }
})

app.get('/addNewAdmin', csrfProtection, givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let restaurant = await Restaurant.findOne({_id:req.payload.ID});
            res.render('addNewAdmin', {user:restaurant.userID, id:restaurant._id, csrf:req.csrfToken()});
        }catch(e){
            res.send(e);
        }
    }
})

app.post('/addNewAdmin', csrfProtection, givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let restaurant = await Restaurant.findOne({_id:req.body.ID});
            let allrestaurant = await Restaurant.find();
            if(req.body.pass==req.body.conpass){
                if(checkForDuplicate(allrestaurant, req.body.email)){
                    let psw = await bcrypt.hash(req.body.pass, 10);
                    let obj = {
                        email:req.body.email,
                        password:psw,
                        designation:'admin'
                    }
                    restaurant.userID.push(obj);
                    await restaurant.save();
                    res.redirect('/admin');
                }else{
                    res.send(`${req.body.email} is already present in the database. Try another email.`);
                    return;
                }
            }else{
                res.send("Password and Confirm password doesn't match.");
                return;
            }
        }catch(e){
            res.send(e);
        }
    }else
        res.redirect('/*');
})

app.post('/addUser', csrfProtection, givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let id = req.body.ID;
            let len = Number(req.body.item); 
            let restaurant = await Restaurant.findOne({_id:id});
            let allrestaurant = await Restaurant.find();
            for(let i=1;i<=len;i++){
                if(req.body['pass'+i]){
                    if(req.body['pass'+i] == req.body['conpass'+i]){
                        if(checkForDuplicate(allrestaurant, req.body['email'+i])){
                            let psw = await bcrypt.hash(req.body['pass'+i],10);
                            let obj = {
                                email:req.body['email'+i],
                                password:psw,
                                designation:req.body['post'+i]
                            }
                            restaurant.userID.push(obj);
                        }
                        else{
                            res.send(`${req.body['email'+i]} already exists. Please fill up the form again.`);
                            return;
                        }
                    }else{
                        res.send(`password and confirm password doesn't match for email ${req.body['email'+i]}. Please fill the form again.`);
                        return;
                    }    
                }
            }
            await restaurant.save();
            //res.send("User upload successful");
            res.redirect('/admin');
        }catch(e){
            res.send(e);
        }
    }else
        res.redirect('/*');
})

app.post('/deleteUser', csrfProtection, givePermission, async (req, res)=>{
    try{
        if(req.payload.designation=='admin'){
            let restaurant = await Restaurant.findOne({'userID.email':req.body.Email});
            restaurant.userID = restaurant.userID.filter((value)=>{
                return value.email!=req.body.Email;
            })
            await restaurant.save();
            res.send(JSON.stringify({successful:true}));
        }else
            res.send(JSON.stringify({successful:false}));
    }catch(e){
        res.send(e);
    }
})


app.get('/adminRestaurantFood', givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let ID = req.query.ID;
            let restaurant = await Restaurant.findOne({_id:ID});
            let foodlist = restaurant.foodDetails;
            for(elem of foodlist){
                if(elem.foodImage){
                    let imgname =  path.basename(elem.foodImage);
                    elem.foodImage = imgname;
                }
            }
            res.render('showRestaurant', {food:true, item:foodlist});
        }catch(e){
            res.send(e);
        }
    }else
        res.redirect('/*');
})

app.get('/adminRestaurantOrder', givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let ID = req.query.ID;
            let restaurant = await Restaurant.findOne({_id:ID});
            res.render('showRestaurant', {order:true, item:restaurant.orderHistory});
        }catch(e){
            res.send(e);
        }
    }else
        res.redirect('/*');
})


app.get('/adminRestaurantUser', csrfProtection, givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let ID = req.query.ID;
            let restaurant = await Restaurant.findOne({_id:ID});
            res.render('restaurantUser', {user:restaurant.userID, id:restaurant._id, csrf:req.csrfToken()});
        }catch(e){
            console.log(e);
        }
    }else
        res.redirect('/*');
})

app.post('/adminRestaurantDelete', csrfProtection, givePermission, async(req, res)=>{
    if(req.payload.designation=='admin'){
        try{
            let id = req.body.ID;
            //console.log(email);
            let result = await Restaurant.deleteOne({_id:id});
            console.log(result);
            res.send({ok:true});
        }catch(e){
            console.log(e);
            res.send({ok:false});
        }
    }else
        res.send("you don't have permission to access the page.");
})


// routes for registered restaurants and admin
app.get("/addnewfood", csrfProtection, givePermission, (req, res)=>{
    if(req.payload.designation=='admim')
        res.render("addFooditem",{isowner:false, csrf:req.csrfToken()});
    else if(req.payload.designation=='owner')
        res.render('addFooditem', {isowner:true, Email:req.payload.email, csrf:req.csrfToken()});
    else
        res.redirect('/orderQueue');
})

app.post('/addnewfood', csrfProtection, givePermission, async(req, res)=>{
    try{
        let restaurant = await Restaurant.findOne({'userID.email':req.body.email});
        for(let i=1;i<=req.body.item;i++){
            if(req.body['foodname'+i]){
                let fileobj = req.files['foodimage'+i];
                // console.log(fileobj);
                let filename = Date.now() + '-' + fileobj.name;
                let obj = {
                    foodName:req.body['foodname'+i],
                    foodPrice:req.body['foodprice'+i],
                    foodDescription:req.body['foodDescription'+i],
                    foodImage: path.join(__dirname, `../uploads/${filename}`)
                }
                restaurant.foodDetails.push(obj);
                fileobj.mv(path.join(__dirname, `../uploads/${filename}`), (err)=>{
                    if(err)
                        res.send(err);
                })
            }
        }
        restaurant.foodDetails.sort(function(a, b){
            if(a.foodName > b.foodName)
                return 1;
            else
                return -1;
        })
        await restaurant.save();
        //res.send('uploaded successfully.');
        if(req.payload.designation=='admin')
            res.redirect('/admin');
        else
            res.redirect('/restaurantHome');
    }catch(e){
        res.send(e);
    }
})


app.get('/login', (req, res)=>{
    try{
        const token = req.cookies.jwt;
        let result = jwt.verify(token, process.env.SECRET_KEY);
        if(result.designation=='admin')
            res.redirect('/admin');
        else if(result.designation=='owner')
            res.redirect('/restaurantHome');
        else
            res.redirect('/orderQueue');
    }catch(e){
        res.render('login');
    }
})


app.post('/login', async(req, res)=>{
    try{
        let data = await Restaurant.findOne({'userID.email':req.body.email});
        //console.log(data);
        let password, designation;
        for(value of data.userID)
            if(req.body.email==value.email){
                password = value.password;
                designation = value.designation;
                break;
            }
        let isexist = await bcrypt.compare(req.body.password, password);
        if(isexist){
            let time = 2*60*1000;
            let token = await data.generateAuthToken(req.body.email, designation, time);
            res.cookie('jwt',token,{
                httpOnly:true,
                path:'/'
                //maxAge: time
            })
            if(designation=='admin')
                res.redirect('/admin');
            else if(designation=='owner')
                res.redirect("/restaurantHome");
            else
                res.redirect('/orderQueue');
        }
        else
            res.status(401).send("email and password doesn't match.");
        }catch(e){
            res.send(e);
        }
})

app.get("/logout", givePermission, async (req, res)=>{
    try{
        req.User.tokens = req.User.tokens.filter((element)=>{
            return element.userToken!=req.Token;
        })
        await req.User.save();
        res.clearCookie("jwt");
        res.clearCookie("_csrf");
        res.redirect('/login');
    }catch(e){
        res.send(e);
    }
})

app.get('/forgotpassword', csrfProtection,(req, res)=>{
    res.render('forgotpass', {csrf:req.csrfToken()});
})

app.post('/forgotpassword', csrfProtection, async (req, res)=>{
    try{
        let email = req.body.email;
        let user = await Restaurant.findOne({'userID.email':email});
        let password, designation;
        for(value of user.userID)
            if(email==value.email){
                password = value.password;
                designation = value.designation;
                break;
            }
        let secretkey = password;
        let payload = {
            email:email,
            id:user._id,
            post:designation
        }
        let passToken = await jwt.sign(payload, secretkey,{expiresIn:'10m'});
        var messageDetails = {
            from:process.env.MAIL,
            to:email,
            subject:"Password recovery",
            text:"Click the link below to recover password.",
            html:`<a href='http://localhost:${port}/forgotpassword/${email}/${passToken}'>Click here to reset password</a>`
        };
        transporter.sendMail(messageDetails, (err, data)=>{
            if(err)
                res.send(err);
            else
                res.send('we sent a link in your email. check it.');
        })
    }catch(e){
        res.send("You are not registered.");
    }
})

app.get('/forgotpassword/:email/:token', async(req, res)=>{
    try{
        let passToken = req.params.token;
        let email = req.params.email;
        let user = await Restaurant.findOne({'userID.email':email});
        let password;
        for(value of user.userID)
            if(email==value.email){
                password = value.password;
                break;
            }
        let secretkey = password;
        let payload = await jwt.verify(passToken, secretkey);
        if(payload){
            res.render('forgotpass', {reset:true, Email:email});
        }else
        res.render('login', {ExpiredSession:true});
    }catch(e){
        console.log(e);
        res.send(e);
    }
})

app.post('/savepassword', async (req, res)=>{
    let newpassword = req.body.newpass;
    let confirmpassword = req.body.conpass;
    let email = req.body.email;
    if(newpassword==confirmpassword){
        try{
            let restaurant = await Restaurant.findOne({'userID.email':email});
            for(value of restaurant.userID)
                if(email==value.email){
                    value.password = await bcrypt.hash(newpassword, 10);
                    break;
                }
            await restaurant.save();
            res.redirect('/login');
        }catch(e){
            res.send('you are not registered.');
        }
    }else
        res.render('forgotpass',{reset:true, Email:email});
})

app.get('/resetPassword', givePermission, (req, res)=>{
    res.render('resetpass', {Email:req.payload.email});
})

app.post('/resetPassword', givePermission, async(req, res)=>{
    let email = req.body.email;
    let currentpass = req.body.currentpass;
    let newpass = req.body.newpass;
    try{
        let restaurant = await Restaurant.findOne({'userID.email':email});
        let password, index=0;
        for(value of restaurant.userID){
            if(email==value.email){
                password = value.password;
                break;
            }else
                index++;
        }
        let isexist = await bcrypt.compare(currentpass, password);
        if(isexist){
            restaurant.userID[index].password = await bcrypt.hash(newpass, 10);
            await restaurant.save();
            res.send("pasword uploaded.");
        }else
            res.send("your current password is wrong.");
    }catch(e){
        res.send(e);
    }
})


app.get("/*", (req, res)=>{
    res.render('404');
})


io.on('connection', socket=>{
    console.log(`connected: ${socket.id}`);

    socket.on('order', async (obj, address)=>{
        try{
            let items = obj;
            let ID = address;
            customerSckt.push(socket.id);

            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.orderDetails.push(items);
            await restaurant.save();

            if(resSckt[ID]){
                for(scktid of resSckt[ID])
                    socket.to(scktid).emit('waiter', items);
            }
            socket.emit('ordersuccessful');
        }catch(e){
            console.log(e);
        }
    })

    socket.on('orderQueue', async (ID)=>{
        try{
            if(resSckt[ID])
                resSckt[ID].push(socket.id);
            else
                resSckt[ID] = [socket.id];
            console.log(resSckt);
            let restaurant = await Restaurant.findOne({_id:ID});
            //restaurant.resSckt.push(socket.id);
            socket.emit('waiter', restaurant.orderDetails);
            //await restaurant.save();
        }catch(e){
            console.log(e);
        }
    })

    socket.on('kitchenRoomOrder', async(ID)=>{
        try{
            if(resSckt[ID])
                resSckt[ID].push(socket.id);
            else
                resSckt[ID] = [socket.id];

            console.log(resSckt);
            let restaurant = await Restaurant.findOne({_id:ID});
            socket.emit('kitchen', restaurant.kitchen);
        }catch(e){
            console.log(e);
        }
    })

    socket.on('previousPayment', async(ID)=>{
        try{
            if(resSckt[ID])
                resSckt[ID].push(socket.id);
            else
                resSckt[ID] = [socket.id];
            
            console.log(resSckt);
            let restaurant = await Restaurant.findOne({_id:ID});
            socket.emit('pendingPayment', restaurant.payment);
        }catch(e){
            console.log(e);
        }
    })

    socket.on('sendToKitchen', async (obj, ID)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.orderDetails = restaurant.orderDetails.filter((value)=>{
                return value.id!= obj.id;
            })

            restaurant.kitchen.push(obj);
            await restaurant.save();

            if(resSckt[ID])
                resSckt[ID].forEach((value)=>{
                    if(value!=socket.id){
                        socket.to(value).emit('kitchen', obj);
                        socket.to(value).emit('refreshWaiter', obj, 'cancel');
                    }
                })

        }catch(e){
            console.log(e);
        }    
    })

    
    socket.on('saveChanges', async(obj, ID, l1)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.orderDetails = restaurant.orderDetails.filter((value)=>{
                return value.id!=obj.id;
            });

            restaurant.orderDetails.push(obj);
            await restaurant.save();

            
            if(resSckt[ID]){
                resSckt[ID].forEach((value)=>{
                    if(value!=socket.id)
                        socket.to(value).emit('refreshWaiter', obj, 'save');
                })
            }

            customerSckt.forEach((value)=>{
                socket.to(value).emit('info', obj, l1, ID);
            })

        }catch(e){
            console.log(e);
        } 
    })

    socket.on('cancelOrderWaiter', async(obj, ID)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.orderDetails = restaurant.orderDetails.filter((value)=>{
                return value.id!=obj.id;
            })

            await restaurant.save();
            if(resSckt[ID]){
                resSckt[ID].forEach((value)=>{
                    if(value!=socket.id)
                        socket.to(value).emit('refreshWaiter', obj, 'cancel');
                })
            }
            
        }catch(e){
            console.log(e);
        }
    })

    socket.on('createPayment', async(obj, ID)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.kitchen = restaurant.kitchen.filter((value)=>{
                return value.id!=obj.id;
            });

            restaurant.payment.push(obj);
            await restaurant.save();

            if(resSckt[ID]){
                resSckt[ID].forEach((value)=>{
                    if(value!=socket.id){
                        socket.to(value).emit('pendingPayment', obj);
                        socket.to(value).emit('refreshKitchen', obj);
                    }
                })  
            }
  
        }catch(e){
            console.log(e);
        }
    })

    socket.on('cancelOrderKitchen', async(obj, ID)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.kitchen = restaurant.kitchen.filter((value)=>{
                return value.id!=obj.id;
            })

            await restaurant.save();

            if(resSckt[ID]){
                resSckt[ID].forEach((value)=>{
                    if(value!=socket.id)
                        socket.to(value).emit('refreshKitchen', obj);
                })
            }
        }catch(e){
            console.log(e);
        }
    })

    
    socket.on('clearpayment', async(obj, ID)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            restaurant.payment = restaurant.payment.filter((value)=>{
                return value.id!=obj.id;
            })

            let date = new Date();
            obj.time = date.toLocaleTimeString();
            obj.day = date.toDateString();
            restaurant.orderHistory.push(obj);
            await restaurant.save();

            if(resSckt[ID]){
                resSckt[ID].forEach((value)=>{
                    if(value!=socket.id)
                        socket.to(value).emit('refreshPayment', obj);
                })
            }
        }catch(e){
            console.log('hello');
            console.log(e);
        }
    })

    socket.on('sendAllitem', async(ID)=>{
        try{
            let restaurant = await Restaurant.findOne({_id:ID});
            let allitem = restaurant.foodDetails;
            socket.emit('receiveAllitem', allitem);
        }catch(e){
            console.log(e);
        }
    })


    socket.on('disconnect', ()=>{
        console.log(`disconnected: ${socket.id}`);
        let dlt = false;
        let index = customerSckt.indexOf(socket.id);
        if(index>=0){
            dlt = true;
            customerSckt.splice(index, 1);
        }

        if(!dlt)
            for(i in resSckt){
                let index = resSckt[i].indexOf(socket.id);
                if(index>=0){
                    resSckt[i].splice(index, 1);
                    break;
                }
            }
        console.log(resSckt);
        console.log(customerSckt);
    })
})

Server.listen(port, (req, res)=>{
    console.log("server running at port 5000.");
})