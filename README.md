
# Bibescu-App
[![Docker Pulls](https://badgen.net/docker/pulls/sand14/bibescu-app?icon=docker&label=pulls)](https://hub.docker.com/r/sand14/bibescu-app)
![GitHub Release](https://img.shields.io/github/v/release/sand14/bibescu-app)


A NextJS application that is Useful for trajectory/time calculation for a Romanian Aviation contest.




## Demo

Currently deployed here for testing: https://bibescu.sand14.ro/


## Deployment

To deploy this in docker-compose:

```bash
  services:
    bibescu-app:
      image: sand14/bibescu-app
      ports:
        - 3000:3000
      environment:
        - GOOGLE_MAPS_API_KEY=xxxxxxx
      restart: unless-stopped
```


## Features

- Google Maps API integration
- Calculate distance(in km) between selected points
- Export the whole journey to a PDF file with a sattelite preview of each point


## License

[MIT](https://choosealicense.com/licenses/mit/)

