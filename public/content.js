/* Izwi content: skills, lessons, rules and explanations. Shared by the server and the browser.
   Edit the words here. No code elsewhere needs to change when lesson text changes. */
(function(root){
const P='Practice task';
const T={
 mic:{name:'Podcasting',fmt:'Podcast',d:'Tell a story with your voice.',L:[
  ['Find your story','Pick one question you care about. A good first episode answers one question in under five minutes.','What makes a good first episode?',['Ten topics in one hour','One question, answered in under five minutes','Reading the news aloud'],1],
  ['Record clean sound','Record in a small room with soft things in it: curtains, a bed, a wardrobe of clothes. Hold the phone a hand’s width from your mouth.','Where is the best place to record?',['An empty hall','A small room with curtains','Beside the road'],1],
  [P,'Record a 60-second introduction. Say your nickname, your question and why it matters. Do not say your school or where you live.']],
  more:['Go further: publish and pitch','Write a three-line pitch for your show: who it is for, what each episode answers and how often it comes out. Stations, festivals and sponsors ask for the pitch first.'],
  res:[['Starting Your Podcast: A Guide for Students','NPR','https://www.npr.org/2018/11/15/662070097/starting-your-podcast-a-guide-for-students','']]},
 video:{name:'Video making',fmt:'Video',d:'Plan, film and edit on a phone.',L:[
  ['Plan three shots','Every story needs a wide shot (where), a medium shot (who) and a close shot (the detail). Draw them before you film.','Which shot shows where the story happens?',['The close shot','The wide shot','The medium shot'],1],
  ['Light and steady','Face the window so light falls on your subject. Lean the phone on a stack of books in place of a tripod.','Where should the window be?',['Behind your subject','In front of your subject, lighting their face','It does not matter'],1],
  [P,'Film a 30-second story in three shots. Ask before you film anyone, and keep other children’s faces out.']],
  more:['Go further: cut for a client','Cut your film to 15, 30 and 60 seconds. Paid work almost always asks for more than one length.'],
  res:[['Video journalism curriculum','PBS News Student Reporting Labs','https://studentreportinglabs.org/curriculum',''],['Photography and video: composition','Canon and Ideas Foundation','https://www.ideasfoundation.org.uk/content/resources/canon-online-digital-storytelling-videos/photography-and-video-composition','']]},
 animation:{name:'Animation',fmt:'Animation',d:'Make drawings move.',L:[
  ['Twelve drawings make a second','Movement is many small changes. Twelve drawings shown in one second look alive.','How many drawings make one second look alive?',['Two','Twelve','One hundred'],1],
  ['Storyboard first','Draw six boxes. Sketch the start, the problem, three steps and the ending before you animate.','What comes before animating?',['A storyboard','Sound effects','The credits'],0],
  [P,'Make a 12-page flipbook of a ball bouncing. Film the pages flipping.']],
  more:['Go further: build a reel','Pick your best ten seconds from three pieces. A short reel is how studios and clients judge animators.'],
  res:[['Pixar in a Box','Khan Academy and Pixar','https://www.khanacademy.org/computing/pixar','']]},
 writing:{name:'Writing',fmt:'Article',d:'Report what you see and argue your case.',L:[
  ['Start with what you saw','Open with one thing you saw or heard yourself. Readers trust a witness.','Why open with something you saw yourself?',['It is shorter','Readers trust a witness','It avoids research'],1],
  ['Who, what, where, when, why','Answer the five questions in your first two sentences. Then add the voices of two other people.','Where do the five answers go?',['At the very end','In the first two sentences','In the headline only'],1],
  [P,'Write 150 words on one change you want in your community. Use first names or nicknames only.']],
  more:['Go further: pitch an editor','Write a four-sentence pitch: the story, why now, who you will speak to and how long it will be.'],
  res:[['Youth Reporter Project training guide','Plan International','https://plan-international.org/uploads/sites/25/2022/02/yrp_training_guide.pdf','']]},
 ai:{name:'Working with AI',fmt:'AI project',d:'Use AI tools well and check what they say.',L:[
  ['What AI is and is not','An AI tool predicts likely words or pictures from examples. It can sound sure and still be wrong.','An AI tool sounds very confident. What does that tell you?',['It is correct','Nothing. It can still be wrong','It asked an expert'],1],
  ['Ask better questions','Tell the tool who it is helping, what you need and what to leave out. Check every answer against a second source.','What do you do with an AI answer before using it?',['Check it against a second source','Share it at once','Make it longer'],0],
  [P,'Ask an AI tool to explain a topic from school. Find one thing it got wrong or left out about your country.']],
  more:['Go further: say how you used it','Write two sentences that tell your audience which AI tool you used, what for, and what you checked yourself. Add them to anything you publish.'],
  res:[['Experience AI lessons','Raspberry Pi Foundation and Google DeepMind','https://experience-ai.org/','y'],['Day of AI curriculum','MIT RAISE','https://dayofai.org',''],['Elements of AI','University of Helsinki','https://elementsofai.com','o']]},
 photo:{name:'Photography',fmt:'Photo story',d:'Tell a story in five photos.',L:[
  ['Rule of thirds','Imagine two lines across and two lines down. Put your subject where the lines cross, not in the centre.','Where does the subject go?',['Dead centre','Where the lines cross','In a corner, very small'],1],
  ['Five-photo story','Opening, person, detail, action, ending. Five photos in that order tell a full story without words.','How many photos tell a full story here?',['One','Five, in order','Fifty'],1],
  [P,'Tell the story of one meal in five photos, from the market or the shamba to the plate.']],
  more:['Go further: caption and permission','Write a caption that answers who, where and when. Decide how others may use your photo before you share it.'],
  res:[['Photography and video: composition','Canon and Ideas Foundation','https://www.ideasfoundation.org.uk/content/resources/canon-online-digital-storytelling-videos/photography-and-video-composition','']]},
 code:{name:'Coding',fmt:'Coding project',d:'Build a simple web page or app.',L:[
  ['What code is','Code is a list of exact instructions for a computer. A web page is built from HTML for structure and CSS for style.','What does HTML give a web page?',['Its colours','Its structure','Its internet connection'],1],
  ['Find and fix bugs','A bug is an instruction that does something you did not mean. Read the error, change one thing and test again.','How many things do you change before testing again?',['One','Five','Everything'],0],
  [P,'Write a one-page site about your cause: a heading, a paragraph and a list of three facts.']],
  more:['Go further: share your code','Put your project where others can read it and write three lines on how to run it. Clear instructions are what employers check first.'],res:[]},
 game:{name:'Game design',fmt:'Game',d:'Design a game others can play.',L:[
  ['Goal, rules, challenge','Every game has a goal, rules and something that makes the goal hard. Write the three down before you build.','What three things does every game need?',['A goal, rules and a challenge','Music, colours and a logo','Coins, levels and prizes'],0],
  ['Test with a friend','Watch someone play without helping them. Where they get stuck is what you fix first.','What do you do while a friend tests your game?',['Explain every step','Watch without helping','Play for them'],1],
  [P,'Design a game on paper that teaches one online safety rule. Play it with two people.']],
  more:['Go further: write the one-page pitch','Name, player, goal and what makes it different. Studios and competitions ask for this page.'],res:[]},
 fashion:{name:'Fashion design',fmt:'Design',d:'Sketch and present your own designs.',L:[
  ['Start from a story','A design begins with a person and a moment: who wears it and where. Collect five pictures, fabrics or colours that fit.','What does a design begin with?',['A price','A person and a moment','A famous brand'],1],
  ['Sketch the shape','Draw the outline first, then the seams, then the details. Label the fabric and colour beside the sketch.','What do you draw first?',['Buttons and details','The outline','The label'],1],
  [P,'Sketch one outfit made from a fabric found in your community. Photograph the sketch, not yourself.']],
  more:['Go further: cost your design','List materials and hours, then price the piece. A designer who can price gets paid.'],res:[]},
 leaders:{name:'Talking to your leaders',fmt:'Speech',d:'Present an issue to people in power.',L:[
  ['Know who decides','Find the person or office that can fix your problem. A chief, a head teacher, a ward administrator and a county officer decide different things.','Who should your request go to?',['Anyone famous','The person or office that can fix it','Whoever replies fastest'],1],
  ['One problem, one ask','Say the problem in one sentence, give one fact and make one clear request. Be polite and specific.','How many requests go in one message to a leader?',['One clear request','As many as possible','None. Just describe the problem'],0],
  [P,'Write three sentences to your head teacher about one thing you want changed: the problem, a fact, your request.']],
  more:['Go further: follow up','After any meeting, send a short thank-you and a date for the next step. Follow-up is where most requests succeed or fail.'],res:[]}
};
const READY=[['I can write and post online','social'],['I know where to get help if I feel unsafe online','unsafe'],['I can report posts online','unsafe'],['I can block and report people online','unsafe'],['I know when someone is bullying me online','bully'],['I know why sites ask my name and age','exploit'],['I know the difference between true and false information online','wrong'],['I can play an online game','social']];
const RO=['Nope','I think I can','I have done it before'];
const TOPICS=[['social','What is social media?','Apps and sites where people share and talk. What you post can travel further than you expect and stay for a long time.'],['bully','What is bullying?','Repeated words or actions meant to hurt someone. Online it can be messages, comments or sharing pictures. It is never the fault of the person targeted.'],['wrong','Wrong information','Not everything online is true. Check who made it, when, and whether another source agrees before you share.'],['exploit','Online exploitation','When someone uses trust, gifts or threats to get something from a child. Anyone asking for secrets, pictures or private details is a warning sign. Tell a trusted adult.'],['unsafe','What to do if you do not feel safe','Stop replying. Do not delete the messages. Use Help at the top of the screen or call Child Helpline 116. Tell an adult you trust.']];
const VALUES=[['Respect','Seeing the worth in other people and in what they make.'],['Mindful','Paying close attention to what you do and how it affects others.'],['Caring','Showing kindness and concern for others.']];
const PRINC=['Children and adults share information and talk with mutual respect.','You can see how your views are used and how they shape the outcome.','You can disagree with adults and offer other solutions.'];
const RULES={y:[['Be safe','Keep private things private. Do not share your phone number, your address, your school or your full name.','Your video shows your school gate. Film it again from another spot.'],['Be nice','Do not say anything mean or hurtful. Treat others the way you want to be treated.','A member’s first podcast has bad sound. Tell them one thing you liked and one tip.'],['Be honest','Do not pretend to be someone else. Do not share pictures, videos or words that are not yours as if you made them.','You used an AI tool or a friend’s clip. Say so in your credit line.'],['Be respectful','Respect other people’s creations and their privacy. Do not copy their work. Do not post pictures or videos of anyone without their permission.','Your friend is in your photo. Ask first, or crop them out.']],
o:[['Be safe','Protect your identity and other people’s. You are responsible for consent from anyone who appears in your work.','A face, a uniform or a street sign can identify a child.'],['Be nice','Critique the work and protect the person. Useful feedback names one strength and one change.','Members stop sharing when feedback turns personal.'],['Be honest','Own your work and credit your sources. Say when you used AI tools, samples or someone else’s footage.','Your name on the work is a promise about how it was made.'],['Be respectful','Argue with evidence. Respect other members’ creations and privacy.','Causes bring together members from many countries, faiths and languages. Disagreement is expected. Contempt is not.']]};
const FEATS=[['learn','Learn','Short lessons in the skills you chose. Each lesson ends with a quick check. Finish a skill to earn its badge.'],['create','Create','Make your own podcast, video, article or animation. Upload it or make it here. It opens when you finish a skill.'],['verse','Toto Verse','The place to watch, listen to and read what other members made. The page has an end, so you can go and create.'],['community','Community','Your class or club group, with your teacher or leader present. There are no private messages.'],['leaders','Causes','A cause is a problem members want fixed. You can join one or start one, then plan and act together.'],['check','Reactions','Three ways to respond to someone’s work: Inspiring, I learned something, Well made. There is no place for hurtful comments.'],['shield','Badges','One badge for each skill you finish. Badges cannot be bought or traded.'],['help','Help 116','Always at the top of the screen. It shows how to talk to a trusted person, and Child Helpline 116, which is free to call.']];
const AUD=[['family','Family','The guardian who said yes'],['class','Classmates','Your own class or club group'],['school','School','Every group in your school'],['community','Community','Members in your area'],['verse','Toto Verse','All Izwi members']];
const WORKINFO=[['Before anyone sees it','A moderator checks every piece. If something is not right, it comes back to you with a reason.'],['You choose who sees it',AUD.map(a=>`<b>${a[1]}.</b> ${a[2]}.`).join('<br>')],['It stays yours','Your work belongs to you. You can take it down at any time.'],['What we know about you','Your nickname, year of birth, country and group. Not your full name, your address or your phone number.'],['What adults can see','Your guardian sees what you made and where you take part. Your teacher or leader sees your progress and your group posts.'],['Leaving','You or your guardian can delete your account and everything in it.']];
const CAUSEHOW=[['Start one or join one','Name the problem, say why it matters and who it affects.'],['Find who decides','Every cause names the person or office that can fix the problem.'],['Talk it through','Prompt questions help the group agree on a solution.'],['Write a memorandum','A short formal letter: the facts, how children are affected, and what you ask for.'],['Spread the word','Campaign messages go out from the Izwi account after review. Writing them opens at 16.'],['Post updates','Tell supporters what happened. Mark the cause as won when it is.']];
const REACT=['Inspiring','I learned something','Well made'];
const CATS=['Education','Entertainment','Informative'];
const REASONS=['Shows personal information','Not kind or respectful','Needs permission from someone shown','Needs a little more work'];
const COUNTRIES=['Kenya','South Africa','Nigeria','Uganda','Tanzania','Ghana','Zimbabwe','Malawi','Rwanda','Zambia'];
const BOOKS=[['Raybearer','Jordan Ifueko',''],['Rebel Sisters','Tochi Onyebuchi',''],['Chicken in the Kitchen','Nnedi Okorafor',''],['The Memory of Love','Aminatta Forna','o']];
const ROUTES={school:['With my school','Use the code from your teacher','teacher'],community:['With my community group','Use the code from your club or group leader','group leader'],own:['On my own','A parent or guardian verifies you directly','']};
const STATUS={leader:'Waiting for your teacher or leader',guardian:'Waiting for your guardian',cosign:'Waiting for a co-sign',review:'Waiting for a moderator',approved:'Approved',returned:'Sent back',escalated:'With the safeguarding lead'};


const EMOJI={mic:'\u{1F399}\uFE0F',video:'\u{1F3AC}',animation:'\u{1F39E}\uFE0F',writing:'\u270D\uFE0F',ai:'\u{1F916}',photo:'\u{1F4F7}',code:'\u{1F4BB}',game:'\u{1F3AE}',fashion:'\u{1F457}',leaders:'\u{1F3DB}\uFE0F'};
const AVATARS=['\u{1F981}','\u{1F418}','\u{1F992}','\u{1F993}','\u{1F98F}','\u{1F406}','\u{1F9A9}','\u{1F99C}','\u{1F422}','\u{1F989}','\u{1F41D}','\u{1F98B}','\u{1F42C}','\u{1F98A}','\u{1F43C}','\u{1F984}'];
const COLORS=['#FFD166','#FF8A5B','#F78FB3','#B892FF','#7CC6FE','#6EE7B7','#C3F584','#FFB3C7'];
const KINDS=['post','update','memo','message'];
const STAGES=['consent','ready','safety','rules','features','work','skills','done'];
const lessonsOf=(k,band)=>band==='o'?[...T[k].L,T[k].more]:T[k].L;
const need=band=>band==='o'?4:3;
const C={P,T,READY,RO,TOPICS,VALUES,PRINC,RULES,FEATS,AUD,WORKINFO,CAUSEHOW,REACT,CATS,REASONS,COUNTRIES,BOOKS,ROUTES,STATUS,EMOJI,AVATARS,COLORS,KINDS,STAGES,lessonsOf,need};
if(typeof module!=='undefined'&&module.exports)module.exports=C;else root.IZWI=C;
})(typeof self!=='undefined'?self:this);
