const fs = require('fs')
const path = require('path')

require('dotenv').config();

const neo4j = require('neo4j-driver')

const { NEO4J_HOST,
    NEO4J_USERNAME,
    NEO4J_PASSWORD,
    AURA_VERSION,
} = process.env

const header = `[.procedures, opts=header, cols='5a,1a', separator=¦]
|===
¦ Qualified Name ¦ Type`

const footer = `|===`

const driver = new neo4j.driver(NEO4J_HOST, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD))

const session = driver.session()

session.readTransaction(tx => tx.run(`
    CALL apoc.help('')
    YIELD name, text, type
    RETURN name, text, type
    ORDER BY CASE WHEN size(split(name, '.')) = 2 THEN [1] ELSE [2] END ASC, name ASC
`))
    .then(res => res.records.map(row => {
        const name = row.get('name')
        const text = row.get('text')
        const type = row.get('type')

        const parts = name.split('.')
        const namespace = parts.length == 2 ? 'apoc' : parts.slice(0, 2).join('.')

        // REMOVED UNTIL DESCRIPTION SYNTAX IS IMPROVED
        // let description = ''
        // if (text.includes(' - ')){
        //     description = text.split(' - ')[1]
        // } else if(text.includes(' | ')){
        //     description = text.split(' | ')[1]
        // } else if(text.startsWith(name)) {
        //     description = text.split(') ')[1]
        // } else {
        //     description = text
        // }

        return {
            name,
            text,
            type,
            namespace,
        }
    }))
    .then(procedures => procedures.reduce((acc, current) => {
        if ( !acc[current.namespace] ) {
            acc[current.namespace] = []
        }

        acc[current.namespace].push(current)

        return acc
    }, {}))
    .then(namespaces =>  Object.entries(namespaces).map(([namespace, procedures]) => `
=== ${namespace}

${header}
${procedures.map(({ name, text, type }) => `¦ link:https://neo4j.com/labs/apoc/${AURA_VERSION}/overview/${namespace}/${name}[${name} icon:book[] ^] +
${text || ''}
¦ label:${type}[]`).join('')}
${footer}`).join('\n\n'))
    .then(adoc => {
        const dir = path.join(__dirname, '..', 'modules', 'root', 'partials', 'apoc-procedures.adoc')

        fs.writeFileSync(dir, `// This file is auto-generated by scripts/apoc.js
// Do not edit!

// Timestamp
[NOTE]
Generated on ${new Intl.DateTimeFormat("en-US", {day: "numeric", month:"long", year: "numeric"}).format(new Date())}.

${adoc}`)
    })
    .then(() => driver.close())