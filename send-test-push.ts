import axios from "axios";

// PASTE YOUR EXPO PUSH TOKEN COPIED FROM EXPO HERE
// Format: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
const TEST_EXPO_TOKEN = "YOUR_COPIED_EXPO_TOKEN_HERE";

const payload = [
  {
    to: TEST_EXPO_TOKEN,
    sound: "default",
    title: "Test Notification",
    body: "Hello! This is a test push notification from PyramidEdu backend using Expo Push Service.",
    data: {
      testKey: "testValue",
    },
  },
];

console.log("Sending test notification to Expo Push Service...");

axios
  .post("https://exp.host/--/api/v2/push/send", payload, {
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
  })
  .then((response) => {
    const data = response.data;
    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
  })
  .catch((error) => {
    console.error("Error sending message:", error.response ? error.response.data : error.message);
  });
