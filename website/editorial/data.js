// The site's content until something is published in /admin (which then
// replaces this file). Plain JSON values, so the Worker can read them too.
// r = width / height. A slideshow photo links to its project (project, n).

window.LANDING = [
  {
    "src": "photos/landing/01.jpg",
    "r": 1.167,
    "project": "unmasked",
    "n": 8
  },
  {
    "src": "photos/landing/02.jpg",
    "r": 1.167,
    "project": "still-here",
    "n": 5
  },
  {
    "src": "photos/landing/03.jpg",
    "r": 1.167,
    "project": "elsewhere",
    "n": 8
  },
  {
    "src": "photos/landing/04.jpg",
    "r": 1.225,
    "project": "sleeeep",
    "n": 2
  },
  {
    "src": "photos/landing/05.jpg",
    "r": 1.167,
    "project": "elsewhere",
    "n": 1
  },
  {
    "src": "photos/landing/06.jpg",
    "r": 1.166,
    "project": "taste-of-routine",
    "n": 1
  },
  {
    "src": "photos/landing/07.jpg",
    "r": 1.167,
    "project": "elsewhere",
    "n": 6
  },
  {
    "src": "photos/landing/08.jpg",
    "r": 1.251,
    "project": "taste-of-routine",
    "n": 2
  },
  {
    "src": "photos/landing/09.jpg",
    "r": 1.252,
    "project": "unmasked",
    "n": 7
  },
  {
    "src": "photos/landing/10.jpg",
    "r": 1.095,
    "project": "taste-of-routine",
    "n": 6
  },
  {
    "src": "photos/landing/11.jpg",
    "r": 1.252,
    "project": "unmasked",
    "n": 6
  },
  {
    "src": "photos/landing/12.jpg",
    "r": 1.245,
    "project": "taste-of-routine",
    "n": 8
  },
  {
    "src": "photos/landing/13.jpg",
    "r": 1.333,
    "project": "unarmoured",
    "n": 6
  },
  {
    "src": "photos/landing/14.jpg",
    "r": 1.167,
    "project": "unmasked",
    "n": 11
  },
  {
    "src": "photos/landing/15.jpg",
    "r": 1.225,
    "project": "sleeeep",
    "n": 7
  },
  {
    "src": "photos/landing/16.jpg",
    "r": 1.262,
    "project": "still-here",
    "n": 8
  }
];

window.PROJECTS = [
  {
    "id": "cold",
    "title": "Cold",
    "photos": [
      {
        "src": "photos/cold/01.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/02.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/03.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/04.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/05.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/06.jpg",
        "r": 0.8
      },
      {
        "src": "photos/cold/07.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/08.jpg",
        "r": 0.667
      },
      {
        "src": "photos/cold/09.jpg",
        "r": 0.667
      }
    ]
  },
  {
    "id": "elsewhere",
    "title": "Elsewhere",
    "photos": [
      {
        "src": "photos/elsewhere/01.jpg",
        "r": 1.167
      },
      {
        "src": "photos/elsewhere/02.jpg",
        "r": 1.226
      },
      {
        "src": "photos/elsewhere/03.jpg",
        "r": 1.225
      },
      {
        "src": "photos/elsewhere/04.jpg",
        "r": 1.167
      },
      {
        "src": "photos/elsewhere/05.jpg",
        "r": 1.167
      },
      {
        "src": "photos/elsewhere/06.jpg",
        "r": 1.167
      },
      {
        "src": "photos/elsewhere/07.jpg",
        "r": 1.22
      },
      {
        "src": "photos/elsewhere/08.jpg",
        "r": 1.167
      },
      {
        "src": "photos/elsewhere/09.jpg",
        "r": 1.226
      },
      {
        "src": "photos/elsewhere/10.jpg",
        "r": 1.225
      }
    ]
  },
  {
    "id": "erode",
    "title": "Erode Clothing AW 25",
    "photos": [
      {
        "src": "photos/erode/01.jpg",
        "r": 0.667
      },
      {
        "src": "photos/erode/02.jpg",
        "r": 0.667
      },
      {
        "src": "photos/erode/03.jpg",
        "r": 0.667
      },
      {
        "src": "photos/erode/04.jpg",
        "r": 0.8
      },
      {
        "src": "photos/erode/05.jpg",
        "r": 0.8
      },
      {
        "src": "photos/erode/06.jpg",
        "r": 0.667
      },
      {
        "src": "photos/erode/07.jpg",
        "r": 1.777
      },
      {
        "src": "photos/erode/08.jpg",
        "r": 0.8
      },
      {
        "src": "photos/erode/09.jpg",
        "r": 1.499
      },
      {
        "src": "photos/erode/10.jpg",
        "r": 0.667
      }
    ]
  },
  {
    "id": "sleeeep",
    "title": "Sleeeep",
    "photos": [
      {
        "src": "photos/sleeeep/01.jpg",
        "r": 1.226
      },
      {
        "src": "photos/sleeeep/02.jpg",
        "r": 1.226
      },
      {
        "src": "photos/sleeeep/03.jpg",
        "r": 1.226
      },
      {
        "src": "photos/sleeeep/04.jpg",
        "r": 1.226
      },
      {
        "src": "photos/sleeeep/05.jpg",
        "r": 1.226
      },
      {
        "src": "photos/sleeeep/06.jpg",
        "r": 1.226
      },
      {
        "src": "photos/sleeeep/07.jpg",
        "r": 1.226
      }
    ]
  },
  {
    "id": "still-here",
    "title": "Still Here",
    "photos": [
      {
        "src": "photos/still-here/01.jpg",
        "r": 1.167
      },
      {
        "src": "photos/still-here/02.jpg",
        "r": 1.219
      },
      {
        "src": "photos/still-here/03.jpg",
        "r": 1.26
      },
      {
        "src": "photos/still-here/04.jpg",
        "r": 0.857
      },
      {
        "src": "photos/still-here/05.jpg",
        "r": 1.167
      },
      {
        "src": "photos/still-here/06.jpg",
        "r": 0.799
      },
      {
        "src": "photos/still-here/07.jpg",
        "r": 1.219
      },
      {
        "src": "photos/still-here/08.jpg",
        "r": 1.261
      }
    ]
  },
  {
    "id": "taste-of-routine",
    "title": "Taste of Routine",
    "photos": [
      {
        "src": "photos/taste-of-routine/01.jpg",
        "r": 1.166
      },
      {
        "src": "photos/taste-of-routine/02.jpg",
        "r": 1.251
      },
      {
        "src": "photos/taste-of-routine/03.jpg",
        "r": 1.25
      },
      {
        "src": "photos/taste-of-routine/04.jpg",
        "r": 1.186
      },
      {
        "src": "photos/taste-of-routine/05.jpg",
        "r": 1.223
      },
      {
        "src": "photos/taste-of-routine/06.jpg",
        "r": 1.095
      },
      {
        "src": "photos/taste-of-routine/07.jpg",
        "r": 1.259
      },
      {
        "src": "photos/taste-of-routine/08.jpg",
        "r": 1.245
      }
    ]
  },
  {
    "id": "unarmoured",
    "title": "Unarmoured",
    "photos": [
      {
        "src": "photos/unarmoured/00.jpg",
        "r": 0.667
      },
      {
        "src": "photos/unarmoured/01.jpg",
        "r": 1.499
      },
      {
        "src": "photos/unarmoured/02.jpg",
        "r": 1.333
      },
      {
        "src": "photos/unarmoured/03.jpg",
        "r": 1.333
      },
      {
        "src": "photos/unarmoured/04.jpg",
        "r": 1.499
      },
      {
        "src": "photos/unarmoured/05.jpg",
        "r": 1.333
      },
      {
        "src": "photos/unarmoured/06.jpg",
        "r": 1.205
      },
      {
        "src": "photos/unarmoured/07.jpg",
        "r": 1.25
      },
      {
        "src": "photos/unarmoured/08.jpg",
        "r": 1.333
      }
    ]
  },
  {
    "id": "unmasked",
    "title": "Unmasked",
    "photos": [
      {
        "src": "photos/unmasked/01.jpg",
        "r": 1.499
      },
      {
        "src": "photos/unmasked/02.jpg",
        "r": 1.167
      },
      {
        "src": "photos/unmasked/03.jpg",
        "r": 1.167
      },
      {
        "src": "photos/unmasked/04.jpg",
        "r": 1.167
      },
      {
        "src": "photos/unmasked/05.jpg",
        "r": 1.167
      },
      {
        "src": "photos/unmasked/06.jpg",
        "r": 1.253
      },
      {
        "src": "photos/unmasked/07.jpg",
        "r": 1.253
      },
      {
        "src": "photos/unmasked/08.jpg",
        "r": 1.167
      },
      {
        "src": "photos/unmasked/09.jpg",
        "r": 1.167
      },
      {
        "src": "photos/unmasked/10.jpg",
        "r": 1.499
      },
      {
        "src": "photos/unmasked/11.jpg",
        "r": 1.167
      }
    ]
  }
];

window.SITE = {
  "bio": [
    "Sundar Rajan is a fashion photographer working between India and Europe. His work explores the relationship between fashion and the human experience, using clothing as a means of expressing identity, emotion and the complexities of being human.",
    "Drawn to the space between what is seen and what is felt, his images explore the tension between appearance and reality, the personal and the collective, and the worlds people inhabit and imagine. His practice approaches fashion as more than an expression of aesthetics, seeing it as a way to tell stories, question perceptions and explore the world around us."
  ],
  "contact": {
    "email": "work.photosbysundar@gmail.com",
    "instagram": {
      "label": "@photosbysundar",
      "href": "https://www.instagram.com/photosbysundar/"
    },
    "based": "India — Europe"
  }
};
