import nodemailer from 'nodemailer'


export function sendMyMail({ from, to, subject, text }) {
   const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT || "587",
      secure: process.env.MAIL_SECURE === "true",
      auth: {
         user: process.env.MAIL_USER,
         pass: process.env.MAIL_PASSWORD,
      },
      name: process.env.MAIL_DOMAIN,
   })
   return transporter.sendMail({ from, to, subject, text, html: text })
}



export function generateRandomCode(count, alphabet) {
    let result = '';
    const alphabetLength = alphabet.length;

    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * alphabetLength);
        result += alphabet[randomIndex];
    }
    return result;
}

