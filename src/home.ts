import { InfinityDate, URL_HOME, ENABLE_INSERT_MP, HIDDEN_ASSIGNMENTS, STORAGE_KEY_KIKUZOU, STORAGE_KEY_SMARTPHONE, STORAGE_KEY_ASSIGNMENT_HISTORY, STORAGE_KEY_SEARCH_SYLLABUS, STORAGE_KEY_STYLE_PERMISSION } from "./module/const";
import { HTMLInputEvent, AssignmentMember } from "./module/type";
import Assignment from "./module/Assignment";
import AssignmentViewer from "./module/AssignmentViewer";
import * as Storage from "./module/storage";

let startMpDone = false; // 未提出課題一覧が表示されているかどうか

// 初期化する。
const init = async () => {
  await insertMpButton();
  await overwriteStyles();
  await hideElements();
};

// manaba上部にManaba Plusのコンテンツを挿入する。
const insertMpButton = async () => {
  const enableInsertMp = await Storage.getBoolean(ENABLE_INSERT_MP);
  if (enableInsertMp === false) return;

  const mark = document.getElementsByClassName("contentbody-left")[0];
  mark.insertAdjacentHTML("afterbegin", await (await fetch(chrome.runtime.getURL("insert.html"))).text());
  document.getElementById("show-assignment").onclick = () => {
    startMp();
  };
  document.getElementById("download-content").onclick = () => {
    if (confirm("コースコンテンツをPCにまとめてダウンロードします。続行しますか？")) {
      window.open(chrome.runtime.getURL("download-progress.html"));
    }
  };
  document.getElementById("open-option").onclick = () => {
    window.open(chrome.runtime.getURL("options.html"));
  };
};

// manabaのHTML要素のstyleを上書きする。
const overwriteStyles = async () => {
  const style_permission = await Storage.getBoolean(STORAGE_KEY_STYLE_PERMISSION);
  if (style_permission !== true) {
    return;
  }

  const contentbody_left = document.getElementsByClassName("contentbody-left")[0] as HTMLElement;
  contentbody_left.style.width = "671px";
  contentbody_left.style.paddingRight = "15px";

  document.getElementById("courselistweekly").style.paddingRight = "0px";
  const infolistHeaders = document.getElementsByClassName("my-infolist-header") as HTMLCollectionOf<HTMLElement>;
  Array.from(infolistHeaders).forEach((element) => {
    element.style.backgroundSize = "100% 100%";
  });

  const tableHeaders = document.querySelectorAll<HTMLElement>(".courselist th");
  tableHeaders[0].setAttribute("width", "auto");
  tableHeaders[1].setAttribute("width", "50px");
  tableHeaders[2].setAttribute("width", "50px");
  tableHeaders[3].setAttribute("width", "20%");
}

// 要素を非表示にする。
const hideElements = async () => {
  const hide = (className: string) => {
    const target = document.getElementsByClassName(className)[0] as HTMLElement;
    target.setAttribute("hidden", "");
  }

  const style_permission = await Storage.getBoolean(STORAGE_KEY_STYLE_PERMISSION);
  const search_syllabus = await Storage.getBoolean(STORAGE_KEY_SEARCH_SYLLABUS);
  const assignment_history = await Storage.getBoolean(STORAGE_KEY_ASSIGNMENT_HISTORY);
  const smartphone = await Storage.getBoolean(STORAGE_KEY_SMARTPHONE);
  const kikuzou = await Storage.getBoolean(STORAGE_KEY_KIKUZOU);

  if (search_syllabus) {
    hide("my-infolist-searchall");
  }

  if (assignment_history) {
    hide("my-infolist-event");
  }

  if (smartphone) {
    const elements = document.getElementsByClassName("my-infolist-tips") as HTMLCollectionOf<HTMLElement>;
    const target = Array.from(elements).find(element => !element.classList.contains("my-infolist-kikuzou"));
    target.setAttribute("hidden", "");
  }

  if (kikuzou) {
    hide("my-infolist-kikuzou");
  }

  if (style_permission && [search_syllabus, assignment_history, smartphone, kikuzou].every(x => x)) {
    const contentbody_left = document.getElementsByClassName("contentbody-left")[0] as HTMLElement;
    contentbody_left.style.width = "916px";

    const my_infolist_mycourses = document.getElementsByClassName("my-infolist-mycourses")[0] as HTMLElement;
    my_infolist_mycourses.style.paddingLeft = "10px";

    const elements = document.getElementsByClassName("course") as HTMLCollectionOf<HTMLElement>;
    Array.from(elements).forEach(element => {
      element.style.height = "60px";
    });
  }
}

// 未提出課題一覧を表示する。
const startMp = async () => {
  // prevent over two times button click
  if (startMpDone) return;
  startMpDone = true;

  // fetch assignment datas
  const allAssignments = await fetchSummaries();
  const hidedAssignments = await fetchHided();
  const courseURLs = getCourseURLs();

  const viewer = new AssignmentViewer(allAssignments, hidedAssignments, courseURLs);
  Assignment.inputClick = viewer.inputClick;

  // show toggles
  document.getElementById("toggles").style.display = "flex";
  document.getElementById("toggle-extra-ass-hide").onchange = (e: HTMLInputEvent) => {
    viewer.showExtraAssIs(e.target.checked);
    viewer.repaint();
  };
  document.getElementById("toggle-hide").onchange = (e: HTMLInputEvent) => {
    viewer.showDisableAssIs(e.target.checked);
    viewer.repaint();
  };

  viewer.repaint();
};

// manabaの未提出課題一覧から課題のリストを取得する。
const fetchSummaries = async () => {
  const docParser = (doc: Document) => {
    const clipStr = (element: HTMLElement) => {
      let str = element.innerText;
      str = str.replace(/\r?\n/g, ""); // delete return
      str = str.replace(/\s+/g, ""); // delete space
      return str;
    };

    const assignmentDomRows = doc.querySelector<HTMLTableElement>("table").getElementsByTagName("tr");
    for (let i = 0; i < assignmentDomRows.length; i++) {
      if (i === 0) continue; // skip title
      const cols = assignmentDomRows[i].children as HTMLCollectionOf<HTMLElement>;
      const dict: AssignmentMember = {
        courseName: clipStr(cols[1]),
        href: cols[0].getElementsByTagName("a")[0].href,
        assignmentName: clipStr(cols[0]),
        deadline: cols[2].innerText ? new Date(cols[2].innerText) : InfinityDate,
        disable: false,
        colorCode: "#fff",
      };
      const assignment = new Assignment();
      assignment.initJson(dict);
      assignments.push(assignment);
    }
  };

  const assignments = [] as Assignment[];
  const targetUrls = [URL_HOME + "_summary_query", URL_HOME + "_summary_survey", URL_HOME + "_summary_report"];
  for (const url of targetUrls) {
    const res = await fetch(url);
    const text = await res.text();
    const domparser = new DOMParser();
    const doc = domparser.parseFromString(text, "text/html");
    docParser(doc);
  }
  return assignments;
};

// 非表示の課題リストを取得する。
const fetchHided = async () => {
  const res = await new Promise((resolve) => {
    chrome.storage.sync.get([HIDDEN_ASSIGNMENTS], function (result) {
      if (!result[HIDDEN_ASSIGNMENTS]) resolve([]);
      resolve(result[HIDDEN_ASSIGNMENTS]);
    });
  });
  return res as string[];
};

// 各コースのURLを取得する。
const getCourseURLs = () => {
  const manabaCourseDOMs = document.querySelectorAll<HTMLAnchorElement>(".course-cell a:first-child");
  const courseURLs = [] as string[];
  manabaCourseDOMs.forEach((manabaCourseDOM) => {
    courseURLs.push(manabaCourseDOM.href);
  });
  return courseURLs;
};

init();
