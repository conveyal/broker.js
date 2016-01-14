/**
 * Read the broker configuration file
 */

import YAML from 'yamljs'
import { readFileSync } from 'fs'

// TODO configurable config file path
export default YAML.parse(readFileSync('config.yaml', 'utf8'))
