const PORT = 3000;
const getCustomerId = () => '1'; // faking this because building an account provisiong/login system is out of scope

const getBooleanFromString = (value: string) => {
  switch(value){

       case "true":

       case "1":
       case "on":
       case "yes":
           return true;
       default:
           return false;
   }
  }

export { PORT, getCustomerId, getBooleanFromString };
