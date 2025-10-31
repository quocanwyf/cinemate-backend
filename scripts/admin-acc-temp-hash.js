import * as bcrypt from 'bcrypt';

const password = 'AdminPassword123';
const saltRounds = 10;
bcrypt.hash(password, saltRounds, function (err, hash) {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Your hashed password is:');
  console.log(hash);
});
