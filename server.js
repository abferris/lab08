'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Database Setup
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

// API Routes
app.get('/location', (request, response) => {
  getLocation(request.query.data)
    .then(location => {
      // console.log('27', location);
      response.send(location)
    })
    .catch(error => handleError(error, response));
})

  app.get('/weather', getWeather);
  app.get('/meetups', getMeetups);
  app.get('/movies', getMovies);
  app.get('/yelp', getYelp);
  app.get('/trails',getTrails);

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// *********************
// MODELS
// *********************

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.formatted_address;
  this.latitude = res.geometry.location.lat;
  this.longitude = res.geometry.location.lng;
};

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
};

function Meetup(meetup) {
  this.link = meetup.link;
  this.name = meetup.group.name;
  this.creation_date = new Date(meetup.group.created).toString().slice(0, 15);
  this.host = meetup.group.who;
};

// MOVIEDB CONSRUCTOR
function  Movie(movie) {
  this.title = movie.title;
  this.released_on = movie.relase_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
};

// YELP CONSTRUCTOR
function Yelp(place) {
  this.url = place.url;
  this.name = place.name
  this.rating = place.rating;
  this.price = place.price
  this.image_url = place.image_url
};

// HIKING CONSTRUCTOR
function Hike(hike){
  this.trail_url = hike.url;
  this.name = hike.name;
  this.location = hike.location;
  this.length = hike.length;
  this.condition_date = hike.conditionDate.split(' ')[0];
  this.condition_time = hike.conditionDate.split(' ')[1];
  this.conditions = hike.conditionDetails;
  this.stars = hike.stars;
  this.star_votes = hike.starVotes;
  this.summary = hike.summary;
}

// *********************
// HELPER FUNCTIONS
// *********************

function handleError(err, res) {
  // console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

function getLocation(query) {
  // CREATE the query string to check for the existence of the location
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [query];

  // Make the query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        // console.log('From SQL');
        return result.rows[0];

        // Otherwise get the location information from the Google API
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

        return superagent.get(url)
          .then(data => {
            // console.log('FROM API line 90');
            // Throw an error if there is a problem with the API request
            if (!data.body.results.length) { throw 'no Data' }

            // Otherwise create an instance of Location
            else {
              let location = new Location(query, data.body.results[0]);
              // console.log('98', location);

              // Create a query string to INSERT a new record with the location data
              let newSQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING id;`;
              // console.log('102', newSQL)
              let newValues = Object.values(location);
              // console.log('104', newValues)

              // Add the record to the database
              return client.query(newSQL, newValues)
                .then(result => {
                  // console.log('108', result.rows);
                  // Attach the id of the newly created record to the instance of location.
                  // This will be used to connect the location to the other databases.
                  // console.log('114', result.rows[0].id)
                  location.id = result.rows[0].id;
                  return location;
                })
                .catch(console.error);
            }
          })
          .catch(error => console.log('Error in SQL Call'));
      }
    });
}

function getWeather(request, response) {
  const SQL = `SELECT * FROM weathers WHERE location_id=$1`;
  const values = [request.query.data.id];
  return client.query(SQL, values)
  .then(result => {
    if (result.rowCount>0){
      response.send(result.rows);
    } else {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      superagent.get(url)
        .then(result =>{
          const weatherSummaries = result.body.daily.data.map(day =>{
            
            const summary = new Weather (day)
            return summary
          });
          let newSQL = `INSERT INTO weathers(forecast, time, location_id) VALUES ($1, $2, $3);`;
          weatherSummaries.forEach( summary => {
            let newValues = Object.values(summary);
            newValues.push(request.query.data.id);
            return client.query(newSQL, newValues)
              .catch(console.error);
          });
          response.send(weatherSummaries);
        })
        .catch(error => handleError(error,response));
    };
  });
};

function getMeetups(request, response) {
  const SQL = `SELECT * FROM meetups WHERE location_id=$1`
  const values = [request.query.data.id];
  return client.query(SQL, values)
  .then(result =>{
    if(result.rowCount>0){
      response.send(result.rows);
    } else{
      const url = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${request.query.data.longitude}&page=20&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`;

      superagent.get(url)
        .then(result => {
          const meetups = result.body.events.map(meetup => {
            const event = new Meetup(meetup);
            return event;
          });
          //SQL work to be done
          let newSQL = `INSERT INTO meetups(link, name, creation_date, host, location_id) VALUES ($1, $2, $3, $4, $5);`
          // console.log('reached 194')
          meetups.forEach( meetup => {
            let newValues = Object.values(meetup);
            newValues.push(request.query.data.id);
            // console.log(newValues, "MEETUP");
            
            return client.query(newSQL, newValues)
              .catch(console.error);
          });
          response.send(meetups)
        })
        .catch(error => handleError(error,response));
    };
  });
};

//Yelp function
function getYelp(request, response){
  console.log('yelp started at 224')
  const SQL = `SELECT * FROM yelp WHERE location_id=$1;`;
  const values =[request.query.data.id];
  return client.query(SQL, values)
  .then(result => {
    if(result.rowCount>0) {
      response.send(result.rows);
      console.log('loaded previous data')
    } 
      else{
        console.log('no cached data')
        const url = `https://api.yelp.com/v3/businesses/search?latitude=${request.query.data.latitude}&longitude=${request.query.data.longitude}`;
        superagent.get(url)
          .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
            .then(result => {
              console.log(result.body);
              const businesses = result.body.businesses.map(business=>{
              const entry =new Yelp(business);
              return entry;
            });
            //SQL START
            let newSQL =`INSERT INTO yelp (url, name, rating, price, image_url, location_id) VALUES ($1, $2, $3, $4, $5, $6);`;
            businesses.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues)
                .catch(console.error);
            });
            console.log(businesses)
            response.send(businesses);
          })
          .catch(error => handleError(error,response))
      };
  });
};
//hiking function
function getTrails(request, response){
  const SQL = `SELECT * FROM hikes WHERE location_id=$1;`;
  const values = [request.query.data.id];  
     return client.query(SQL, values)
      .then(result =>{        
        if (result.rowCount>0) {
          response.send(result.rows);
        } else{
          const url = `https://www.hikingproject.com/data/get-trails?lat=${request.query.data.latitude}&lon=${request.query.data.longitude}&maxDistance=10&key=${process.env.TRAILS_API_KEY}`;

          superagent.get(url)  
            .then(result =>{
              const hikeSummaries = result.body.trails.map(hike =>{
                const trail = new Hike(hike);
                // console.log(trail);
                return trail;
              });
              let newSQL =`INSERT INTO hikes(trail_url, name, location, length, condition_date, condition_time, conditions, stars, star_votes, summary, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`;
              hikeSummaries.forEach( hike => {
                let newValues = Object.values(hike);
                // console.log('looking for newvalues at 258', newValues.condition);
                // console.log(`test at 246`, newSQL, newValues);
                newValues.push(request.query.data.id);
                // console.log(newValues, "TRAILS");
                return client.query(newSQL, newValues)
                  .catch(console.error, 'ERROR');
              });
              response.send(hikeSummaries)
            })
            .catch(error =>handleError(error,response));
        };
      });
};
// MOVIE DB FUNCTION
function getMovies (request, response){
  // console.log('movies started 272', request.query.data.id)
  const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
  const values = [request.query.data.id];
  return client.query(SQL, values)
  .then(result => {
    if (result.rowCount>0){
      console.log('previous data')
      response.send(result.rows)
    } else{
      // console.log('no previous data', request.query.data.search_query)
      const url = `https://api.themoviedb.org/3/search/movie?query=${request.query.data.search_query}&page=1&include_adult=False
&language=en-US&api_key=${process.env.MOVIEDB_API_KEY}`
      // console.log(url, 'request url')    
      superagent.get(url)
      .then(result =>{
        // console.log('287 into superagent', result.body)
        const movieSummaries = result.body.results.map(movie => {
          const film = new Movie(movie);
          // console.log('film at 280',film)
          return film;
         
        });

        let newSQL = `INSERT INTO movies (title, released_on, total_votes, average_votes, popularity, image_url, location_id) VALUES($1, $2, $3, $4, $5, $6, $7);`;
        movieSummaries.forEach(movie => {
          let newValues = Object.values(movie);
          newValues.push(request.query.data.id);
          return client.query(newSQL, newValues)
          .catch(console.error);
        });
        // console.log('all movies',   movieSummaries)
        response.send(movieSummaries)
      })
      .catch(error =>handleError(error,response));
    };
  });
};
