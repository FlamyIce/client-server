const express = require('express');
const mysql = require('mysql');
const path = require('path');
const app = express();
const port = 3000;

const db = mysql.createConnection({
    host: '',
    user: '',
    password: '',
    database: ''
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to database.');
});

app.use(express.static(__dirname));

app.get('/regions', (req, res) => {
    db.query('SELECT DISTINCT stop_area FROM harlamov_stops', (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results.map(row => row.stop_area));
        }
    });
});

app.get('/stops/:region', (req, res) => {
    const region = req.params.region;
    db.query('SELECT stop_name FROM harlamov_stops WHERE stop_area = ?', [region], (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results.map(row => row.stop_name));
        }
    });
});

app.get('/buses/:stop', (req, res) => {
    const stop = req.params.stop;
    db.query(`
        SELECT DISTINCT r.route_short_name, r.route_long_name
        FROM harlamov_stop_times st
        JOIN harlamov_trips t ON st.trip_id = t.trip_id
        JOIN harlamov_routes r ON t.route_id = r.route_id
        JOIN harlamov_stops s ON st.stop_id = s.stop_id
        WHERE s.stop_name = ?
        ORDER BY r.route_short_name`, [stop], (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results.map(row => row.route_short_name));
        }
    });
});
app.get('/nearest/:latitude/:longitude', (req, res) => {
    const { latitude, longitude } = req.params;

    db.query(`
        SELECT stop_name, 
               stop_lat, 
               stop_lon, 
               (6371 * acos(cos(radians(?)) * cos(radians(stop_lat)) * cos(radians(stop_lon) - radians(?)) 
               + sin(radians(?)) * sin(radians(stop_lat)))) AS distance
        FROM harlamov_stops
        ORDER BY distance
        LIMIT 1
    `, [latitude, longitude, latitude], (err, results) => {
        if (err) {
            console.error('Error fetching nearest stop:', err);
            res.status(500).send('Internal Server Error');
        } else if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('No stops found nearby.');
        }
    });
});

app.get('/arrivals/:stop/:bus', (req, res) => {
    const { stop, bus } = req.params;
    db.query(`
        SELECT st.arrival_time
        FROM harlamov_stop_times st, harlamov_trips t, harlamov_routes r, harlamov_stops s
        WHERE st.trip_id = t.trip_id
        AND t.route_id = r.route_id
        AND st.stop_id = s.stop_id
        AND s.stop_name = ?
        AND r.route_short_name = ?
        ORDER BY st.arrival_time LIMIT 5`, [stop, bus], (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results.map(row => row.arrival_time));
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
