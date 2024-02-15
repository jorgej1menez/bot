import query from '../database/dbpromise.js'
import fetch from 'node-fetch'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import fs from 'fs'
import path from 'path'

async function getAllCategories() {
    const apiUrl = 'https://your-wordpress-site/wp-json/wp/v2/categories';

    try {
        const response = await fetch(apiUrl);

        if (response.ok) {
            const categories = await response.json();
            console.log('Categories:', categories);
        } else {
            console.error('Failed to retrieve categories:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error retrieving categories:', error);
    }
}

export { getAllCategories }