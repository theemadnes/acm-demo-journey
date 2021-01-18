require('dotenv').config()

const express = require('express')
const app = express()
const path = require('path')
const port = 3000

const {PubSub} = require('@google-cloud/pubsub')
const pubSubClient = new PubSub()
const topicName = 'projects/' + process.env.project_id + '/topics/demo-app-topic'
const data = JSON.stringify({payload: 'hello pubsub'})

app.get('/', (req, res) => {
  //res.send('Hello World!')
  res.sendFile(path.join(__dirname + '/index.html'));
})

// Switching over to async as the downstream calls to PubSub are as well
app.get('/gcp_check/', async function(req, res) {

// Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
const dataBuffer = Buffer.from(data);

try {
    const messageId = await pubSubClient.topic(topicName).publish(dataBuffer);
    console.log(`Message ${messageId} published.`);
    res.send(`Message ${messageId} published.`);
    } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    res.status(500).send(`Received error while publishing: ${error.message}`);
    //process.exitCode = 1;
    }
})


app.listen(port, () => {
  console.log(`ACM Config Connector Demo App listening on port ${port}`)
})