import chalk from 'chalk';
import inquirer from 'inquirer'
import dump from '../dump.mjs';
import puppeteer from "puppeteer";
import progress from "progress";
import request from 'request';
import fs, { promises } from 'fs';

let cookie = ""
let email = ""
let password = ""
let main = async() => {

  console.log(chalk.red.bold("raywenderlich Crawler -- FREE WEEKEND"))


  inquirer
    .prompt([{
        type: 'input',
        name: 'email',
        message: chalk.blue.bold(`Email :`)
      }, {
        type: 'input',
        name: 'password',
        message: chalk.blue.bold(`Password :`)
      }

    ])
    .then(async answers => {


      email = answers.email;
      password = answers.password

      console.log(chalk.green.bold("Authenticando"))

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });
      const page = await browser.newPage();
      await page.goto("https://www.raywenderlich.com/sessions/new")
      await page.type('input[name=username]', email)
      await page.type('input[name=password]', password)
      await page.click('button[type=submit]')
      await page.waitForNavigation();
      cookie = await page.cookies()
      await page.close();
      await browser.close();
      console.log(chalk.green.bold("Raspando Cursos!!"))

      await processArray(dump, async(e, k) => {
        await gettingVideos(e)
        return "complete";
      });

      console.log(chalk.green.bold("Baixou Tudoooooo!!"))

    });

}

// let cookieParse = () => {

//   let result = {}

//   cookie.split(";").forEach(e => result[e.split('=')[0]] = e.split('=')[1])



//   return result


// }

// let offline = [{
//     name: '_carolus_session',
//     value: 'bXZ6a0pnNWFhVGlXNU9iTDVYbkNrYXhhV1pIQW80N01XUXQ3akpKVHFSM2pRRVgyM0N6aFd1NEF3VVNzUkgzL1Bqamx5Z1lCS25xYUt6czV4YlFweEd6dEo1d2dVUVIxY1dMSnRSYU8vaWdvK1c2UkxLRVBLL1JFRytBOUZwRWZ1M3Q2eXlVeStPc2ozb0RtdjZ0Y1Yxd0FHc040YlNjYTNPQ3NkZ3RKT2d6aHFDRXFDVEk4OU5VZzVNNVM3TXdmLS12TzRteDR4a01NbWhpNk1kaUgrRmRnPT0%3D--37bff399e27064d4a8a1d1ceb6db271bedcb3ed4',
//     domain: 'www.raywenderlich.com',
//     path: '/',
//     expires: -1,
//     size: 352,
//     httpOnly: true,
//     secure: false,
//     session: true
//   },
//   {
//     name: 'rw-consent-v2',
//     value: 'v201811%7C1556910883',
//     domain: '.raywenderlich.com',
//     path: '/',
//     expires: 1588551277.216607,
//     size: 33,
//     httpOnly: false,
//     secure: false,
//     session: false
//   },
//   {
//     name: 'rw-sso-v2',
//     value: '1b621a7a99b8b3323c111e8d75a19e2df2a00faffbf939516d40c9695b4711cc',
//     domain: '.raywenderlich.com',
//     path: '/',
//     expires: 1564704877.216455,
//     size: 73,
//     httpOnly: false,
//     secure: false,
//     session: false
//   }
// ]

let gettingVideos = async(uri) => {




  let folder = uri.split("/")
  folder = folder[folder.length - 1]

  console.log(chalk.red.bold(folder))



  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  await page.setCookie(...cookie)
  await page.goto(uri + "/lessons/1")
  await page.waitForSelector('iframe[src*="player.vimeo.com"]');




  const lessons = await page.evaluate((uri) => {
    let course = document.querySelector(".c-box-list.c-box-list--linked.c-video-player__lesson-list.c-video-player__lesson-list--open");
    let data = []
    if (course) {

      data = [...document.querySelector(".c-box-list.c-box-list--linked.c-video-player__lesson-list.c-video-player__lesson-list--open").children].map((e, k) => uri + "/lessons/" + (k + 1))


    } else {

      data = [...document.querySelector(".c-tutorial--card.c-tutorial--dark.l-margin-24").querySelectorAll("a")].map(e => "https://www.raywenderlich.com/" + e.pathname)


    }

    return data
  }, uri)

  let datasMp4 = await processArray(lessons, async(e, k) => {
    let video = "",
      title = "",
      mp4 = "";
    await page.goto(e)
    await page.waitForSelector('iframe[src*="player.vimeo.com"]');
    const vimeoSource = await page.evaluate(() => {
      let src = document.querySelector('iframe[src*="player.vimeo.com"]').src;
      return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", src, true);
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4 && xhr.status == 200) {
            resolve(xhr.responseText);
          }
        };
        xhr.send();
      });
    });

    if (vimeoSource) {
      video = JSON.parse(vimeoSource.match("var config = {(.*)};")[0].replace("var config =", "").replace(";", ""));
      title = video.video.title;
      mp4 = video.request.files.progressive.sort((a, b) => b.width - a.width)[0];

    }
    return { video, title, mp4 }
  })



  await processArray(datasMp4, async(e, k) => {
    await download(e.mp4, e.title, folder)
    return "complete"
  })



  await browser.close();
  return "complete";
}

let download = (url, title, folder) => {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync("./videos/" + folder)) {
      fs.mkdirSync("./videos/" + folder);
    }

    var req = request(url);
    const file = fs.createWriteStream("./videos/" + folder + "/" + title + ".mp4");

    req.on('response', (res) => {
      var len = parseInt(res.headers['content-length'], 10);

      var bar = new progress('  downloading [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len
      });

      res.on('data', (chunk) => {
        bar.tick(chunk.length);
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          status: "Complete"
        });

      });
      res.pipe(file);

    });

    req.end();

  })

}
let processArray = async(array, fn) => {
  let results = [];
  for (let i = 0; i < array.length; i++) {
    let r = await fn(array[i], i);
    results.push(r);
  }
  return results;
}


main()