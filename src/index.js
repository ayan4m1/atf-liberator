import inquirer from 'inquirer';
import puppeteer from 'puppeteer';

import loggers from './logging';

const execute = async () => {
  const log = loggers('app');

  try {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null
    });
    const page = await browser.newPage();

    await page.goto('https://alltheflavors.com/');
    log.info('Waiting for login...');
    await page.waitForSelector('a[href="/recipes?owner=both"]', {
      timeout: 0
    });

    log.info('Logged in successfully!');
    await page.goto('https://alltheflavors.com/recipes?owner=both', {
      timeout: 0,
      waitUntil: ['load', 'networkidle0']
    });
    const recipes = await page.$$eval('.recipe-line-title', results =>
      results.map(recipe => ({
        name: recipe.textContent,
        url: recipe.getAttribute('href')
      }))
    );

    log.warn(
      `Found ${recipes.length} recipes. I am going to make them all PUBLIC!`
    );
    log.warn('THIS IS YOUR LAST CHANCE TO TURN BACK!');
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'agreed',
        default: false
      }
    ]);

    if (!answers.agreed) {
      log.info('Wuss.');
      return;
    }

    let successCount = 0;

    for (const recipe of recipes) {
      const { url } = recipe;

      await page.goto(
        `https://alltheflavors.com/my${url.replace(/#.*/, '')}/edit`,
        {
          timeout: 0,
          waitUntil: ['load', 'networkidle0']
        }
      );
      let isShared = await page.$eval(
        '#recipe_shared',
        checkbox => checkbox.checked
      );

      if (isShared) {
        log.info(`Skipping ${recipe.name} because it is already shared!`);
        continue;
      }

      await page.$eval('#recipe_shared', checkbox => checkbox.click());
      isShared = await page.$eval(
        '#recipe_shared',
        checkbox => checkbox.checked
      );

      if (!isShared) {
        log.error(`Skipping ${recipe.name} because I cannot click it!`);
        continue;
      }

      await page.$eval('.panel-footer .btn-primary', button => button.click());

      log.info(`Made ${recipe.name} public!`);
      successCount++;
    }

    log.info(`Completed making ${successCount} of ${recipes.length} public`);
  } catch (error) {
    log.error(error.message, error);
  }
};

execute();
