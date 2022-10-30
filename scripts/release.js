const CWD = process.cwd()
const fs = require("fs")
const semver = require("semver")

const pacJsonPath = `${CWD}/package.json`
const inquirer = require("inquirer")
const execa = require("execa")
const path = require("path")

async function release(options) {
    const exists = await asyncFileIsExists(pacJsonPath)
    if (!exists) throw new Error("未发现package.json文件")

    const curVersion = require(pacJsonPath).version
    const bumps = [
        { type: "major", intro: "大版本更新,不能向下兼容" },
        { type: "minor", intro: "小版本更新,兼容老版本" },
        { type: "patch", intro: "补丁版本更新,兼容老版本,只是修复一些bug" },
        { type: "prerelease", intro: "预发版本" },
    ]
    const versions = {}
    bumps.forEach(({ type: b }) => {
        versions[b] = semver.inc(curVersion, b)
    })
    const bumpChoices = bumps.map(({ type: b, intro = "" }) => ({
        name: b === "prerelease" ? `${intro}` : `${intro} (${versions[b]})`,
        value: b,
    }))

    const { bump, customVersion, tag } = await inquirer.prompt([
        {
            name: "bump",
            message: "请选择发布类型:",
            type: "list",
            choices: [...bumpChoices, { name: "自定义版本", value: "custom" }],
        },
        {
            name: "tag",
            message: "请选择预发布类型:",
            type: "list",
            choices: [
                {
                    name: "内测(alpha)",
                    value: "alpha"
                },
                {
                    name: "公测(beta)",
                    value: "beta"
                },
                {
                    name: "候选(rc)",
                    value: "rc"
                },
                {
                    name: "实验(experimental)",
                    value: "experimental"
                }
            ],
            when: (answers) => answers.bump === "prerelease"
        },
        {
            name: "customVersion",
            message: "Input version:",
            type: "input",
            when: (answers) => answers.bump === "custom",
        },
    ])

    let version = customVersion || versions[bump]

    if (tag) {
        version = semver.inc(curVersion, "prerelease", tag)
    }

    const { yes } = await inquirer.prompt([
        {
            name: "yes",
            message: `确定要发布 ${version} 版本?`,
            type: "confirm",
        },
    ])

    if (!yes) return false

    const pkgContent = JSON.parse(fs.readFileSync(pacJsonPath))

    pkgContent.version = version
    fs.writeFileSync(pacJsonPath, JSON.stringify(pkgContent, null, 2))

    if (
        Object.prototype.toString.call(options) === "[object Object]" &&
        options.semVerCallback
    )
        await writeVersionCallback(options.semVerCallback)

    await require("./genChangelog.js")(version)
    await execa("npm", ["run", "build"], {
        stdio: "inherit",
        cwd: path.dirname(pacJsonPath),
    })
}

function asyncFileIsExists(path) {
    return new Promise((resolve) => {
        fs.exists(path, (exists) => {
            resolve(exists)
        })
    })
}

async function writeVersionCallback(callback) {
    if (Object.prototype.toString.call(callback) === "[object Function]") {
        await callback()
    }
    if (Object.prototype.toString.call(callback) === "[object String]") {
        await execa("npm", [callback], { stdio: "inherit" })
    }
}

release().catch((error) => {
    console.error(error)
    process.exit(1)
})
