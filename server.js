'use strict';

// Require depenancies used
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');

//Setting port and assigning varibale for express.
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());

//route to location
app.get('/location', (request, response) => {
  searchToLatLong(request.query.data)
    .then(location => response.send(location))
    .catch(error => handleError(error, response));
})

//route to weather
app.get('/weather', getWeather);

//route to meetup
app.get('/meetups', getMeetup);

//Error handler
function handleError(err, res){
  console.error(err);
  if (res) res.status(500).send('Piss Off');
}

//search lat long funciton
function searchToLatLong(query){
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(url)
    .then(res=>{
      return new Location(query, res);
    })
    .catch(error => handleError);
}

//Weather route handler
function getWeather(request, response){
  const url = `https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
  console.log('In get weather function')
  return superagent.get(url)
    .then(result=>{
      const weatherSummaries = result.body.daily.data.map(day=>{
        return new Weather(day);
      });
      response.send(weatherSummaries);
    })
    .catch(error=>handleError(error, response));
}

//Meetup route handler 
function getMeetup(request, response){
  const url=`https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${request.query.data.longitude}&page=20&radius=10&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`;

  console.log('In getMeetup function')
  return superagent.get(url)
    .then(result=>{
      const meetupSummaries = result.body.events.map(event=>{
        return new Meetup(event)
      });
      response.send(meetupSummaries);
    })
    .catch(error=>handleError(error, response));
}

//location constructor
function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.body.results[0].formatted_address;
  this.latitude = res.body.results[0].geometry.location.lat;
  this.longitude = res.body.results[0].geometry.location.lng;
}

//forecast constructor
function Weather(day){
  this.forecast = day.summary;
  this.time = new Date(day.time*1000).toString().slice(0,15);
}

//meetup constructor
function Meetup(event){
  this.link = event.link;
  this.name = event.group.name;
  this.creation_date = new Date(event.created*1000).toString().slice(0,15);;
  this.host = event.group.who;
  this.create_at = Date.now();
}

app.use('*', (err, res) => handleError(err, res));

app.listen(PORT, () => console.log(`App is up on ${PORT}`));

