require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDB, models } = require("../src/db");

const malePhotos = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80"
];

const femalePhotos = [
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80&sat=-100"  
];

const seedUsers = [
  {
    email: "kofi.mensah@loveconnect.local",
    name: "Kofi Mensah",
    gender: "male",
    birthdate: "1993-03-12",
    location: "Douala",
    interests: ["Sport", "Voyage", "Musique", "Cafe"],
    bio: "Entrepreneur calme, fan de musique live et de voyages. J'aime les cafes de quartier et les longues discussions.",
    photos: [malePhotos[0], malePhotos[1]]
  },
  {
    email: "samuel.ado@loveconnect.local",
    name: "Samuel Ado",
    gender: "male",
    birthdate: "1990-11-05",
    location: "Yaounde",
    interests: ["Cuisine", "Cinema", "Football", "Voyage"],
    bio: "J'aime cuisiner et decouvrir de nouveaux films. Toujours partant pour un match de foot.",
    photos: [malePhotos[2], malePhotos[3]]
  },
  {
    email: "mohamed.diop@loveconnect.local",
    name: "Mohamed Diop",
    gender: "male",
    birthdate: "1996-01-22",
    location: "Dakar",
    interests: ["Tech", "Lecture", "Running", "Podcasts"],
    bio: "Ingenieur et passionne de tech, toujours en mouvement. Je lis beaucoup et j'aime courir en bord de mer.",
    photos: [malePhotos[1], malePhotos[4]]
  },
  {
    email: "junior.ekane@loveconnect.local",
    name: "Junior Ekane",
    gender: "male",
    birthdate: "1992-07-19",
    location: "Bafoussam",
    interests: ["Photographie", "Nature", "Gaming", "Voyage"],
    bio: "Photographe amateur, fan de nature et de gaming. J'aime les week-ends en randonnee.",
    photos: [malePhotos[3], malePhotos[0]]
  },
  {
    email: "alex.kone@loveconnect.local",
    name: "Alex Kone",
    gender: "male",
    birthdate: "1989-09-02",
    location: "Abidjan",
    interests: ["Business", "Musique", "Fitness", "Street Food"],
    bio: "Business et fitness, j'aime l'energie positive et les concerts en plein air.",
    photos: [malePhotos[4], malePhotos[2]]
  },
  {
    email: "amina.bello@loveconnect.local",
    name: "Amina Bello",
    gender: "female",
    birthdate: "1995-04-08",
    location: "Lagos",
    interests: ["Mode", "Voyage", "Cuisine", "Design"],
    bio: "Creative, j'adore voyager et gouter de nouvelles cuisines. Je travaille dans le design.",
    photos: [femalePhotos[0], femalePhotos[1]]
  },
  {
    email: "nadia.kouame@loveconnect.local",
    name: "Nadia Kouame",
    gender: "female",
    birthdate: "1994-06-14",
    location: "Abidjan",
    interests: ["Danse", "Cinema", "Lecture", "Art"],
    bio: "Danseuse passionnee, fan de lecture et de cinema. Toujours partante pour une expo.",
    photos: [femalePhotos[2], femalePhotos[3]]
  },
  {
    email: "lea.tchoumi@loveconnect.local",
    name: "Lea Tchoumi",
    gender: "female",
    birthdate: "1997-10-21",
    location: "Douala",
    interests: ["Art", "Musique", "Nature", "Yoga"],
    bio: "Artiste et amoureuse de la nature. J'aime le yoga et les concerts acoustiques.",
    photos: [femalePhotos[1], femalePhotos[4]]
  },
  {
    email: "sarah.ndiaye@loveconnect.local",
    name: "Sarah Ndiaye",
    gender: "female",
    birthdate: "1991-02-27",
    location: "Dakar",
    interests: ["Yoga", "Voyage", "Lecture", "Cuisine"],
    bio: "Yoga, voyages et bonnes conversations. J'adore cuisiner des plats epices.",
    photos: [femalePhotos[3], femalePhotos[0]]
  },
  {
    email: "judith.mbappe@loveconnect.local",
    name: "Judith Mbappe",
    gender: "female",
    birthdate: "1998-12-03",
    location: "Yaounde",
    interests: ["Startups", "Design", "Cinema", "Mode"],
    bio: "J'aime le design et l'entrepreneuriat. Toujours en veille sur les startups.",
    photos: [femalePhotos[4], femalePhotos[2]]
  }
];

const seed = async () => {
  await connectDB();

  const passwordHash = bcrypt.hashSync("Password123!", 10);

  for (const user of seedUsers) {
    await models.User.findOneAndUpdate(
      { email: user.email },
      {
        ...user,
        password_hash: passwordHash,
        verified: true,
        verified_photo: true,
        premium: false,
        onboarding_completed: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("Seed users created/updated with gender-specific photos.");
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
