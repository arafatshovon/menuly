// let d1 = new Date();
// console.log(d1.toDateString());
// console.log(d1.toLocaleDateString());
// console.log(d1.toLocaleTimeString());
// console.log(d1.toLocaleString());
// console.log(d1.toTimeString());
// var email = 'arafatshovon1897@gmail.com';
// const qrcode = require('qrcode');
// qrcode.toFile('F:/Node Js/menuly/uploads/qrcode.png',`<a href="http://localhost:5000/${email}/5">Google</a>`, {type:'image/png'}, function(err){
//     if(err)
//         console.log(err);
//     else
//         console.log('successful');
// })
// var Validator = require('validator');
// email = '1906191@eeeac@bd';
// if(Validator.isEmail(email))
//     console.log("true")
// else
//     console.log('false');
let car = [];
for(value of car)
    console.log(value);
console.log(car);

// function maketable(fo, fd, alltable){
//     for(elem of fo){
//         var l1 = Object.keys(elem.orderedFoods);
//         var pr = 0, item = [];
//         for(v of l1){
//             console.log(elem.orderedFoods[v]);
//             for(data of fd){
//                 if(v==data._id){
//                     pr += data.foodPrice * elem.orderedFoods[v];
//                     item.push(data.foodName+'-'+elem.orderedFoods[v]);
//                     break;
//                 }
//             }
//         }
//         let obj = {
//             table:elem._id,
//             fditem:item,
//             price:pr
//         }
//         alltable.push(obj);
//     }
// }

// app.post('/check', (req, res)=>{
//     try{
//         console.log(req.body);
//         console.log(req.headers);
//         res.status(200).send({ok:true});
//     }catch(e){
//         res.send(e);
//     }
// })