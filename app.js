const express = require("express");
const chalk = require("chalk");
const socketIO = require("socket.io");

var dsbien = require('./config/nodeID.json');
var system = require('./config/system.json');
var tank1 = require('./config/tank1.json');
var tank2 = require('./config/tank2.json');
var tank3 = require('./config/tank3.json');
var tank4 = require('./config/tank4.json');
var tank5 = require('./config/tank5.json');
var tank6 = require('./config/tank6.json');
var tank7 = require('./config/tank7.json');
var tank8 = require('./config/tank8.json');

var notification = require('./api/notifications/notification');
var value_valve = [];
var mang_update = [];
var mang_csdl = [];
var mang_monitor = [];
for(let i = 0; i < dsbien.length; i++){
    value_valve.push(dsbien[i].socketon)
}
for(let i = 0; i < dsbien.length; i++){
    mang_update.push(dsbien[i].chanel)
}
for(let i = 1; i <= 53; i++){
    mang_csdl.push(i);
}
var dsbien_tank1 = [];
dsbien_tank1.push(dsbien[1])
// SET UP SERVER
var app      = express();
var port     = process.env.PORT || 3000;
// var mongoose = require('mongoose');
// var passport = require('passport');
var flash    = require('connect-flash');
var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var expressSession  = require('express-session');
// var configDB = require('./config/database.js');
var fs = require('fs');
var crypto_utils = require('node-opcua-crypto');
const  {
    OPCUAClient ,
    resolveNodeId,
    AttributeIds,
    ClientMonitoredItemGroup,
    TimestampsToReturn,
   } = require("node-opcua-client");
// mongoose.connect(configDB.url);
// require('./api/config/passport')(passport);
const opcua = require("node-opcua");
const endpointUrl = "opc.tcp://vietscada.com:53530";
// set up database for history //////////////////////////////////////////////
// var mongoClient = require('mongodb').MongoClient;
// var URL = "mongodb+srv://DanhHuynh:danhhuynhquang@lvtn-zmehu.mongodb.net/test?retryWrites=true&w=majority";
// set up our express application
const io = socketIO.listen(app.listen(port));
app.use('/assets', express.static(__dirname + '/public'))
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // set up ejs for templating
// required for passport
app.use(expressSession({
    secret: 'xxxxxxxxxxxxx',
    resave: false,
    saveUninitialized: true,
    maxAge: 24 * 60 * 60 * 1000
}));
// app.use(passport.initialize());
// app.use(passport.session()); // persistent login sessions
// app.use(flash()); // use connect-flash for flash messages stored in session
app.use((req,res,next) => {
    res.header("Access-Control-Allow-Origin","*");
    res.header('Access-Control-Allow-Methods',"*");
    res.header('Access-Control-Allow-Headers',"*");
    next();
});
// require('./routes/routes.js')(app, passport, URL);
// ROUTES
const  userIdentity = { userName: "user", password: "user" };
(async () => {
    try {
        const client = opcua.OPCUAClient.create({
            applicationName: "HCMUT_OPCUA_Client",
            securityMode: opcua.MessageSecurityMode.SignAndEncrypt,
            securityPolicy: opcua.SecurityPolicy.Basic256,
            certificateFile:"./security_client/certificate.pem",
            privateKeyFile:"./security_client/private_key.pem",
            // serverCertificate: crypto_utils.readCertificate("./certificate_server/servercertificate.pem"),
            endpoint_must_exist: false
        });
        client.on("backoff", (retry, delay) => {
            io.sockets.emit('disconnect');
            console.log("Retrying to connect to ", endpointUrl, " attempt ", retry);
        });
        console.log("Connecting to ", chalk.cyan(endpointUrl));
        await client.connect(endpointUrl);
        console.log("Connected to ", chalk.cyan(endpointUrl));
//Create SESSION.....................
        const session = await client.createSession();
        console.log("Session created");
//Create SUBSCRIPTION
        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 100,
            requestedMaxKeepAliveCount: 20,
            requestedLifetimeCount: 6000,
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            priority: 10
        });
       subscription.on("keepalive", function () {
            // console.log("keepalive");
        }).on("terminated", function () {
            console.log("TERMINATED")
        });
        var mang_control_manual = new Array(25);
        for(let i = 0; i < dsbien.length ; i++) {
            let nodeId = dsbien[i].name;
            let itemToMonitor = {
                nodeId: nodeId,
                attributeId: opcua.AttributeIds.Value
            };
            let parameters = {
                samplingInterval: 10,
                discardOldest: true,
                queueSize: 1
            };
            let monitoredItem = await subscription.monitor(itemToMonitor, parameters, opcua.TimestampsToReturn.Both);
            monitoredItem.on("changed", (dataValue) => {
                mang_monitor.push(dataValue.value.value);
                mang_monitor[i] = dataValue.value.value;
                if(50 <=i && i <=74){
                    if(dataValue.value.value.toString() == "true"){
                        let thoigian = new Date();
                        thoigian1 = thoigian.toLocaleDateString() + " " + thoigian.getHours() +":"+ thoigian.getMinutes() +":"+ thoigian.getSeconds();
                        notification(dsbien[i].socketon,thoigian1)
                    }
                }
                if(0 <= i && i <= 24){
                    mang_control_manual[i] = dataValue.value.value.toString();
                }
                let today = new Date();
                today1 = today.toLocaleDateString() + " " + today.getHours() +":"+ today.getMinutes() +":"+ today.getSeconds();

                if( 25 <= i && i <= 77) {
                    mongoClient.connect(URL, function(err, db) {
                        let myobj = {
                            time: today.toLocaleDateString() + " " + today.getHours() +":"+ today.getMinutes() +":"+ today.getSeconds(),
                            value: dataValue.value.value.toString()
                        }
                        let dbo = db.db("variable");
                        dbo.collection(dsbien[i].socketon).insertOne(myobj, function(err, res) {
                        if (err) throw err;
                        db.close();
                        });

                    });
                }
                if(dataValue.value.value.toString() == "true" || dataValue.value.value.toString() == "false"){
                    io.sockets.emit(dsbien[i].chanel.toString(),[dataValue.value.value.toString(),today1]);
                    if(0 <= i && i <= 24){
                        mang_control_manual[i] = dataValue.value.value.toString();
                    }
                } else {
                    io.sockets.emit(dsbien[i].chanel.toString(),dataValue.value.value.toFixed(2));
                    console.log(dataValue.value.value.toFixed(2));
                }
            });
        }

// SOCKET.IO LISTEN REFRESH FROM HTML AND THEN READ VALUE FROM OPCUA SERVER
            io.sockets.on('connection', (socket) => {
                socket.on('reset_control',()=>{
                    mang_control_manual.map((item,index)=>{
                        if(item.toString() == "true"){
                            const nodesToWrite = ({
                                nodeId: dsbien[index].name,
                                attributeId: opcua.AttributeIds.Value,
                                value: {
                                    statusCode: opcua.StatusCodes.Good,
                                    value: {
                                        dataType: opcua.DataType.Boolean,
                                        value: false
                                    }
                                }
                            });
                            session.write(nodesToWrite, function(err,statusCode,diagnosticInfo) {
                                if (!err) {
                                }
                            });
                        }
                    })
                })
                for( let i = 0 ; i <= mang_csdl.length ; i++){
                    socket_csdl(mang_csdl[i])
                }
                function socket_csdl(item){
                    let emit = "emit" + item;
                    socket.on(item,(data)=>{
                        console.log(data)
                         mongoClient.connect(URL, function(err, db) {
                            if (err) throw err;
                            let dbo = db.db("variable");
                                dbo.collection(data).find().toArray(function(err, result) {
                                    socket.emit(emit,result);
                                    if (err) throw err;
                                    db.close();
                                });
                    })
                })
                }
                function socket_on(param){
                    socket.on(param,function(data){
                        if((data.value.toString() == "true" || data.value.toString() == "false") && (data !== null)){
                            const nodesToWrite = ({
                                nodeId: data.nodeid.toString(),
                                attributeId: opcua.AttributeIds.Value,
                                value: {
                                    statusCode: opcua.StatusCodes.Good,
                                    value: {
                                        dataType: opcua.DataType.Boolean,
                                        value: data.value
                                    }
                                }
                            });
                            session.write(nodesToWrite, function(err) {
                                if (!err) {
                                    console.log("wrote boolean data to OPC UA Server!" );
                                }
                            });
                        } else {
                            const nodesToWrite = ({
                                nodeId: data.nodeid.toString(),
                                attributeId: opcua.AttributeIds.Value,
                                value: {
                                    statusCode: opcua.StatusCodes.Good,
                                    value: {
                                        dataType: opcua.DataType.Double,
                                        value: data.value
                                    }
                                }
                            });
                            session.write(nodesToWrite, function(err) {
                                if (!err) {
                                    console.log(" wrote number data to OPC UA Server" );
                                }
                            });
                        }
                    })
                }
                for (var i = 0; i < value_valve.length; i++) {
                    socket_on(value_valve[i]);
                }
            });
            io.sockets.on('connection', (socket) => {
                console.log("vừa mới được reload");
                    setTimeout(() => {
                        ketqua_0 = doc_all_bien_system();
                        ketqua_0.then(function(data0){
                            socket.emit('system',data0);
                            console.log(data0);
                        });
                        setTimeout(() => {
                            ketqua_1 = doc_all_bien_tank1();
                            ketqua_1.then(function(data1){
                                socket.emit('tank1',data1);
                                console.log(data1);
                            });
                            setTimeout(() => {
                                ketqua_2 = doc_all_bien_tank2();
                                ketqua_2.then(function(data2){
                                    socket.emit('tank2',data2);
                                    console.log(data2);
                                });
                                setTimeout(() => {
                                    ketqua_3 = doc_all_bien_tank3();
                                    ketqua_3.then(function(data3){
                                        socket.emit('tank3',data3);
                                        console.log(data3);
                                    });
                                    setTimeout(() => {
                                        ketqua_4 = doc_all_bien_tank4();
                                        ketqua_4.then(function(data4){
                                            socket.emit('tank4',data4);
                                            console.log(data4);
                                        });
                                        setTimeout(() => {
                                            ketqua_5 = doc_all_bien_tank5();
                                            ketqua_5.then(function(data5){
                                                socket.emit('tank5',data5);
                                                console.log(data5);
                                            });
                                            setTimeout(() => {
                                                ketqua_6 = doc_all_bien_tank6();
                                                ketqua_6.then(function(data6){
                                                    socket.emit('tank6',data6);
                                                    console.log(data6);
                                                });
                                                setTimeout(() => {
                                                    ketqua_7 = doc_all_bien_tank7();
                                                    ketqua_7.then(function(data7){
                                                        socket.emit('tank7',data7);
                                                        console.log(data7);
                                                    });
                                                    setTimeout(() => {
                                                        ketqua_8 = doc_all_bien_tank8();
                                                        ketqua_8.then(function(data8){
                                                            socket.emit('tank8',data8);
                                                            console.log(data8);
                                                        });
                                                    }, 400);
                                                }, 400);
                                            }, 400);
                                        }, 400);
                                    }, 400);
                                }, 400);
                            }, 400);
                        }, 400);
                    }, 400);
                }, 400);
            // });
            // io.sockets.on('connection', (socket) => {
            //     console.log("vừa mới được reload");
            //     // ket_qua = doc_all_bien();
            //     // ket_qua.then(function(data){
            //     //     socket.emit('value',data);
            //     // });
            //     ketqua_0 = doc_all_bien_system();
            //     ketqua_0.then(function(data0){
            //         socket.emit('system',data0);
            //         console.log(data0);
            //     });
            //     timeout(500);
            //     ketqua_1 = doc_all_bien_tank1();
            //     ketqua_1.then(function(data1){
            //         socket.emit('tank1',data1);
            //         console.log(data1);
            //     });
            //     timeout(1000);
            //     ketqua_2 = doc_all_bien_tank2();
            //     ketqua_2.then(function(data2){
            //         socket.emit('tank2',data2);
            //         console.log(data2);
            //     });
            //     timeout(1000);
            //     ketqua_3 = doc_all_bien_tank3();
            //     ketqua_3.then(function(data3){
            //         socket.emit('tank3',data3);
            //         console.log(data3);
            //     });
            //     timeout(1000);
            //     ketqua_4 = doc_all_bien_tank4();
            //     ketqua_4.then(function(data4){
            //         socket.emit('tank4',data4);
            //         console.log(data4);
            //     });
            //     timeout(1000);
            //     ketqua_5 = doc_all_bien_tank5();
            //     ketqua_5.then(function(data5){
            //         socket.emit('tank5',data5);
            //         console.log(data5);
            //     });
            //     timeout(1000);
            //     ketqua_6 = doc_all_bien_tank6();
            //     ketqua_6.then(function(data6){
            //         socket.emit('tank6',data6);
            //         console.log(data6);
            //     });
            //     timeout(1000);
            //     ketqua_7 = doc_all_bien_tank7();
            //     ketqua_7.then(function(data7){
            //         socket.emit('tank7',data7);
            //         console.log(data7);
            //     });
            //     timeout(1000);
            //     ketqua_8 = doc_all_bien_tank8();
            //     ketqua_8.then(function(data8){
            //         socket.emit('tank8',data8);
            //         console.log(data8);
            //     // });
            // });
            // var mangsolieu = new Array();
            // function doc_1_bien(node,i){
            //     let nodeIdToMonitor = node;
            //     let maxAge = 0;
            //     let nodeToRead = { nodeId: nodeIdToMonitor, attributeId: opcua.AttributeIds.Value};
            //     return new Promise(function(res) {
            //         session.read(nodeToRead, maxAge , function(err,dataValue) {
            //             if(dataValue !== undefined) {
            //                 mangsolieu[i] = dataValue.value.value;
            //             }
            //             return res();
            //         });
            //     });
            // }
            // async function doc_all_bien(){
            //         for(i = 0; i < dsbien.length ; i ++){
            //             await doc_1_bien(dsbien[i].name,i);
            //         };
            //         return mangsolieu;
            // };
            /////////////////////////////////////////////////////
            function doc_1_bien(node, i, mang){
                let nodeIdToMonitor = node;
                let maxAge = 0;
                let nodeToRead = { nodeId: nodeIdToMonitor, attributeId: opcua.AttributeIds.Value};
                return new Promise(function(res) {
                    session.read(nodeToRead, maxAge , function(err,dataValue) {
                        if(dataValue !== undefined) {
                            mang[i] = dataValue.value.value;
                        }
                        return res();
                    });
                });
            }
            function timeout(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }
            // RELOAD SYSTEM
            var mangsolieu0 = new Array();
            async function doc_all_bien_system(){
                    for(i = 0; i < system.length ; i ++){
                        await doc_1_bien(system[i].name, i, mangsolieu0);
                    };
                    return mangsolieu0;
            };
            // RELOAD TANK1
            var mangsolieu1 = new Array();
            async function doc_all_bien_tank1(){
                    for(i = 0; i < tank1.length ; i ++){
                        await doc_1_bien(tank1[i].name, i, mangsolieu1);
                    };
                    return mangsolieu1;
            };
            // RELOAD TANK2
            var mangsolieu2 = new Array();
            async function doc_all_bien_tank2(){
                    for(i = 0; i < tank2.length ; i ++){
                        await doc_1_bien(tank2[i].name, i, mangsolieu2);
                    };
                    return mangsolieu2;
            };
            // RELOAD TANK3
            var mangsolieu3 = new Array();
            async function doc_all_bien_tank3(){
                    for(i = 0; i < tank3.length ; i ++){
                        await doc_1_bien(tank3[i].name, i, mangsolieu3);
                    };
                    return mangsolieu3;
            };
            // RELOAD TANK4
            var mangsolieu4 = new Array();
            async function doc_all_bien_tank4(){
                    for(i = 0; i < tank4.length ; i ++){
                        await doc_1_bien(tank4[i].name, i, mangsolieu4);
                    };
                    return mangsolieu4;
            };
            // RELOAD TANK5
            var mangsolieu5 = new Array();
            async function doc_all_bien_tank5(){
                    for(i = 0; i < tank5.length ; i ++){
                        await doc_1_bien(tank5[i].name, i, mangsolieu5);
                    };
                    return mangsolieu5;
            };
            // RELOAD TANK6
            var mangsolieu6 = new Array();
            async function doc_all_bien_tank6(){
                    for(i = 0; i < tank6.length ; i ++){
                        await doc_1_bien(tank6[i].name, i, mangsolieu6);
                    };
                    return mangsolieu6;
            };
            // RELOAD TANK7
            var mangsolieu7 = new Array();
            async function doc_all_bien_tank7(){
                    for(i = 0; i < tank7.length ; i ++){
                        await doc_1_bien(tank7[i].name, i, mangsolieu7);
                    };
                    return mangsolieu7;
            };
            // RELOAD TANK8
            var mangsolieu8 = new Array();
            async function doc_all_bien_tank8(){
                    for(i = 0; i < tank8.length ; i ++){
                        await doc_1_bien(tank8[i].name, i, mangsolieu8);
                    };
                    return mangsolieu8;
            };
            ////////////////////////////////////////////////////////

// detect CTRL+C and close
        let running = true;
        process.on("SIGINT", async () => {
            if (!running) {
                return; // avoid calling shutdown twice
            }
            console.log("Shutting down client");
            running = false;
            await subscription.terminate();
            await session.close();
            await client.disconnect();
            console.log("Done");
            process.exit(0);
        });
    }
    catch (err) {
        console.log(chalk.bgRed.white("Error" + err.message));
        console.log(err);
        process.exit(-1);
    }
})();
