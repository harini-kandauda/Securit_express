import express from 'express'
import { PrismaClient } from "@prisma/client"
import bcrypt from 'bcryptjs'
import {v4 as uuidv4} from 'uuid'
import cookieParser from 'cookie-parser'
import { generateRandomCode, sendMyMail } from './lib/mail.mjs'

import 'dotenv/config'


const prisma = new PrismaClient()

const app = express()

const codes = {}

app.set('view engine', 'ejs')

/////////////////////// MIDDLEWARES ////////////////////////////

//couche assets
app.use('/assets', express.static('./assets'))

//couche Cookiesparser
app.use(cookieParser())

//couche bodyparser
app.use(express.urlencoded({ extended: true }))

////////////////////// ROUTES ///////////////////////////////////


//Route de connexion
app.get('/login', (req, res) => {
   res.render('login', {error_message : ""});
})

//Route d'inscription
app.get('/register', async (req, res) => {
   res.render('register', 
      {error_message : ""}
   )
})

//Créer un compte
app.post('/create_account', async (req, res) => { 

   const { email, password, password2 } = req.body;
   
   if (password === password2) {
      let user = await prisma.user.findUnique({
         where: { email }
      })
      if (user) {
         res.render('register', { error_message : 'Cet utilisateur existe déjà.' })
      } else {
         const saltRounds = 3;
         const hashedPassword = await bcrypt.hash(password, saltRounds);
         const user = await prisma.user.create({
            data : {
               email, 
               password : hashedPassword, 
               role: 'inspector',
            }
         })
         res.render('success-account')
      }
   } else {
     res.render('register', { error_message : 'Les mots de passe sont différents' });
   }
})

//Vérification de l'Utilisateur
app.post('/check-user', async (req, res) => {
   const { email, password } = req.body;

   const user = await prisma.user.findUnique({
            where: { email }
   });

   if (user) {
      const match = await bcrypt.compare(password, user.password);
      
      if (match) {
         const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
         const code = generateRandomCode(5, alphabet);
         codes[email] = code
   
         await sendMyMail ({
            from: process.env.MAIL_SENDER,
            to: email,
            subject: 'Code de vérification Maud',
            text: `Votre code de confirmation est ${code}`,
         })

         res.cookie('code_verif', '123', { httpOnly: true, maxAge: 1*30*1000 });
         res.render('verify_code', {email, error_message: ''});

      } else {
         res.render('login', {error_message : "Email ou mot de passe incorrect."})
      }
   } else {
      res.render('login', {error_message : "Email ou mot de passe incorrect."})
   }
})


//Vérification du Code de vérification
app.post('/verify_code', async (req, res) => {
   const {email, code} = req.body;
   const cookie_verif = req.cookies['code_verif'];
   
   if (cookie_verif === "123") {
      // Si la session est valide, vérifiez le code de vérification
      if (codes[email] === code) {
         const user = await prisma.user.findUnique({
            where: { email: email }
         });

         let session_uuid = uuidv4(); 

         const session = await prisma.session.create({
               data: {
               session_id: session_uuid,
               user_id: user.id,
               }
         });

         res.cookie('session_id', session.session_id, { httpOnly: true, maxAge: 10 * 60 * 1000 });
         res.redirect('/visits');

      } else {
         // Si le code de vérification est incorrect
         res.render('verify_code', { email, error_message: "Code de confirmation incorrect." });
      }
   } else {
      // Si le code a expiré
      res.render('login', { email, error_message: "Code expiré" });
   }
});


/////////////////// COUCHES SECURISEES /////////////////////////////

app.use("/", (req, res, next) => {
   if (req.cookies.session_id) {
      next();
   } else {
      res.render("login", { error_message: "Session expirée." });
   }
   });

//couche visits
app.get('/visits', async (req, res) => {
   const current_session = req.cookies.session_id;
   const authenticated_user = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            session_id: current_session,
          },
        },
      },
    });
   const visits = await prisma.visit.findMany({
      include: { company : true },
   });
   res.render('visits', {user: authenticated_user, visits: visits}
   );
})

//redirige vers create-visit/nouvelle visite
app.get('/create-visit', async (req, res) => {
   const current_session = req.cookies.session_id;
   const authenticated_user = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            session_id: current_session,
          },
        },
      },
    });

   const companies = await prisma.company.findMany();

   res.render('create-visit', 
      {
         user: authenticated_user,
         companies: companies,
         errorMessage: "",
       }
   )
})


//Enregistrer une visite
app.post('/register-visit', async (req, res) => { 
   console.log(req.body)

   const { visit_date, company, report } = req.body;
   
   const date = new Date(visit_date); // Convertir la date en objet Date

   const current_session = req.cookies.session_id; // Récupérer la session en cours depuis les cookies

   // Vérification de l'existence de l'utilisateur avec la session en cours
    const authenticated_user = await prisma.user.findFirst({
      where: {
        sessions: {
          some: {
            session_id: current_session,
          },
        },
      },
    });
   
   // Création de la visite
   const new_visit = await prisma.visit.create({
      data: {
        user_id: authenticated_user.id,
        date: date,
        company_id: parseInt(company),
        report: report || "" , // Si le rapport est vide, on le remplace par une chaîne vide
      },
    });

   
   const visit_list = await prisma.visit.findMany({
      where: { user_id: authenticated_user.id },
      include: {
        company: true, // Inclut les informations de la compagnie associée
      },
    });
  
   res.render('visits', {
      user: authenticated_user,
      visits: visit_list,
    })
})

////////////////////////////////////////////////////////////////////


const PORT = process.env.PORT || 3005
app.listen(PORT, () => {
   console.log(`Server listening on port http://localhost:${PORT}`)
})