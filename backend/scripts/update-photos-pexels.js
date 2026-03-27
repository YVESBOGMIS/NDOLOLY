require("dotenv").config();
const { connectDB, models } = require("../src/db");

const malePhotos = [
  "https://images.pexels.com/photos/19705630/pexels-photo-19705630.png?cs=srgb&dl=pexels-domineves-anthony-2054574-19705630.jpg&fm=jpg",
  "https://images.pexels.com/photos/6311583/pexels-photo-6311583.jpeg?cs=srgb&dl=pexels-gabby-k-6311583.jpg&fm=jpg",
  "https://images.pexels.com/photos/33826140/pexels-photo-33826140.jpeg?cs=srgb&dl=pexels-lekepov-2044219506-33826140.jpg&fm=jpg",
  "https://images.pexels.com/photos/36167360/pexels-photo-36167360.jpeg?cs=srgb&dl=pexels-samuel-idim-2107167-36167360.jpg&fm=jpg",
  "https://images.pexels.com/photos/18800766/pexels-photo-18800766.jpeg?cs=srgb&dl=pexels-felix-segbefia-767016290-18800766.jpg&fm=jpg",
  "https://images.pexels.com/photos/18279200/pexels-photo-18279200.jpeg?cs=srgb&dl=pexels-joecreativestudio-18279200.jpg&fm=jpg",
  "https://images.pexels.com/photos/15606896/pexels-photo-15606896.jpeg?cs=srgb&dl=pexels-ogproductionz-15606896.jpg&fm=jpg",
  "https://images.pexels.com/photos/30519608/pexels-photo-30519608.jpeg?cs=srgb&dl=pexels-venus-30519608.jpg&fm=jpg",
  "https://images.pexels.com/photos/7533355/pexels-photo-7533355.jpeg?cs=srgb&dl=pexels-shvets-production-7533355.jpg&fm=jpg",
  "https://images.pexels.com/photos/26734890/pexels-photo-26734890.jpeg?cs=srgb&dl=pexels-rob-ruth-1406909-26734890.jpg&fm=jpg"
];

const femalePhotos = [
  "https://images.pexels.com/photos/17300044/pexels-photo-17300044.jpeg?cs=srgb&dl=pexels-bave-pictures-64453798-17300044.jpg&fm=jpg",
  "https://images.pexels.com/photos/19405107/pexels-photo-19405107.jpeg?cs=srgb&dl=pexels-dystopiasavagestudios-19405107.jpg&fm=jpg",
  "https://images.pexels.com/photos/33640564/pexels-photo-33640564.jpeg?cs=srgb&dl=pexels-mccutcheon-21942475-33640564.jpg&fm=jpg",
  "https://images.pexels.com/photos/29479562/pexels-photo-29479562.jpeg?cs=srgb&dl=pexels-mikeh-29479562.jpg&fm=jpg",
  "https://images.pexels.com/photos/30938750/pexels-photo-30938750.jpeg?cs=srgb&dl=pexels-baobab-photos-2149382979-30938750.jpg&fm=jpg",
  "https://images.pexels.com/photos/26146973/pexels-photo-26146973.jpeg?cs=srgb&dl=pexels-valdansmedia-26146973.jpg&fm=jpg",
  "https://images.pexels.com/photos/29198005/pexels-photo-29198005.jpeg?cs=srgb&dl=pexels-thekehindeogunsanya-29198005.jpg&fm=jpg",
  "https://images.pexels.com/photos/17300043/pexels-photo-17300043.jpeg?cs=srgb&dl=pexels-bave-pictures-64453798-17300043.jpg&fm=jpg",
  "https://images.pexels.com/photos/34670709/pexels-photo-34670709.jpeg?cs=srgb&dl=pexels-soft__work__-1913651507-34670709.jpg&fm=jpg",
  "https://images.pexels.com/photos/30147915/pexels-photo-30147915.jpeg?cs=srgb&dl=pexels-chadpopulisphotography-30147915.jpg&fm=jpg"
];

const updateGenderPhotos = async (gender, urls) => {
  const users = await models.User.find({ gender }).sort({ email: 1 });
  let idx = 0;

  for (const user of users) {
    const url = urls[idx % urls.length];
    user.photos = [url, url];
    await user.save();
    idx += 1;
  }

  console.log(`Updated ${users.length} ${gender} users.`);
};

const run = async () => {
  await connectDB();
  await updateGenderPhotos("male", malePhotos);
  await updateGenderPhotos("female", femalePhotos);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
