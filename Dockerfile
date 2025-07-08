# השתמש בגרסת Node.js רשמית וקלת משקל
FROM node:18-alpine

# הגדר את תיקיית העבודה בתוך הקונטיינר
WORKDIR /usr/src/app

# העתק את הקבצים שמגדירים את התלויות
COPY package*.json ./

# התקן את התלויות
RUN npm install

# העתק את שאר קבצי האפליקציה
COPY . .

# חשוף את הפורט שהאפליקציה רצה עליו
EXPOSE 80

# הפקודה שתריץ את השרת
CMD [ "node", "server.js" ]