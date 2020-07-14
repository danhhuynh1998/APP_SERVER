const nodemailer = require('nodemailer');

var maillist = [
    '',
  ];

let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: 'opc.ua.thesis@gmail.com',
        pass: 'luanvank16'
    }
});


module.exports = function (subject, detail) {
let mailOptions = {
    from: 'opc.ua.thesis@gmail.com',
    to: maillist,
    subject: subject,
    text: "time of errors " + detail
};
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error.message);
    }
    console.log('send email successfully');
});
}