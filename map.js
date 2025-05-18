// map.js
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

mapboxgl.accessToken = 'pk.eyJ1Ijoicm9oYW52aWQiLCJhIjoiY2w5cHJnbDZzMGR5cTNucG1tNTRxM2trbCJ9.WzW1nQJuNsE9DZ4zvPjWKw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-71.092761, 42.357575],
  zoom: 13,
});

const svg = d3.select('#map svg');

const projection = d3.geoTransform({
  point: function (x, y) {
    const p = map.project(new mapboxgl.LngLat(x, y));
    this.stream.point(p.x, p.y);
  },
});

const path = d3.geoPath().projection(projection);

Promise.all([
  d3.json('https://dsc106.com/assets/bike/boston-bike-lanes.json'),
  d3.json('https://dsc106.com/assets/bike/boston-cambridge.json'),
  d3.json('https://dsc106.com/assets/bike/stations.json'),
  d3.csv('https://dsc106.com/assets/bike/traffic.csv', d3.autoType),
]).then(([lanes, neighborhoods, stations, traffic]) => {
  const lanesPath = svg.append('path')
    .datum(lanes)
    .attr('fill', 'none')
    .attr('stroke', '#aaa')
    .attr('stroke-width', 1.5);

  const circles = svg.selectAll('circle')
    .data(stations.features)
    .join('circle')
    .attr('r', 5)
    .attr('stroke', '#fff');

  function updateSliderLabel(val) {
    const minutes = +val;
    const label = document.getElementById('selected-time');
    const anyTime = document.getElementById('any-time');

    if (minutes < 0) {
      label.textContent = '';
      anyTime.style.display = 'inline';
    } else {
      const h = Math.floor(minutes / 60);
      const m = String(minutes % 60).padStart(2, '0');
      label.textContent = `${h}:${m}`;
      anyTime.style.display = 'none';
    }
  }

  const slider = document.getElementById('time-slider');
  updateSliderLabel(slider.value);

  function render(timeVal = -1) {
    let selected = traffic;
    if (timeVal >= 0) {
      selected = traffic.filter(d => d.minute === +timeVal);
    }

    const byStation = d3.rollups(
      selected,
      v => ({
        departures: d3.sum(v, d => d.count * (d.type === 'departure')),
        arrivals: d3.sum(v, d => d.count * (d.type === 'arrival')),
      }),
      d => d.station
    );

    const trafficMap = new Map(byStation);

    circles
      .attr('transform', d => {
        const [x, y] = projection.stream.point(d.geometry.coordinates[0], d.geometry.coordinates[1]).__data__;
        return `translate(${x},${y})`;
      })
      .attr('r', d => {
        const stat = trafficMap.get(d.properties.id);
        return stat ? Math.sqrt(stat.arrivals + stat.departures) : 2;
      })
      .attr('fill', d => {
        const stat = trafficMap.get(d.properties.id);
        const ratio = stat ? stat.departures / (stat.arrivals + stat.departures) : 0.5;
        return d3.interpolateRdYlBu(1 - ratio);
      });
  }

  render();

  slider.addEventListener('input', (e) => {
    const val = +e.target.value;
    updateSliderLabel(val);
    render(val);
  });

  function update() {
    lanesPath.attr('d', path);
    render(slider.value);
  }

  map.on('move', update);
  map.on('moveend', update);

  update();
});
