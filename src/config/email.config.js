import { createTransport } from "nodemailer";

const emailConfig = createTransport({
    service: "smtp.gmail.com",
    port: 587,
    secure : process.env.NODE_ENV == "production" ? true : false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    from : process.env.EMAIL_FROM
});

export default emailConfig